import { Router } from "express";
import type { Logger } from "pino";
import { assertDatabaseReady } from "../../db/connection.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
import type { Mailer, SendResult } from "../../services/email/mailer.js";
import { confirmationEmail, notificationEmail } from "./lead.emails.js";
import { Lead, newPublicRef } from "./lead.model.js";
import { CONSENT_VERSION } from "./lead.options.js";
import { leadInputSchema } from "./lead.schema.js";

type Deps = { mailer: Mailer; logger: Logger; /** Envois autorisés par IP et par quart d'heure. */ rateLimit?: number };

// La réponse n'attend pas les emails plus que ce délai : la demande est déjà enregistrée.
const EMAIL_WAIT_MS = 6000;

type LeadDoc = InstanceType<typeof Lead>;

/** Envoie l'accusé de réception et la notification, en enregistrant chaque tentative sur le prospect. */
export async function deliverLeadEmails(lead: LeadDoc, mailer: Mailer): Promise<void> {
  const data = lead.toObject();
  const jobs: { kind: "confirmation" | "notification"; run: () => Promise<SendResult> }[] = [];

  if (data.emails?.confirmation?.status !== "sent") {
    jobs.push({ kind: "confirmation", run: () => mailer.send(confirmationEmail(data)) });
  }
  if (data.emails?.notification?.status !== "sent") {
    const admin = mailer.adminEmail;
    jobs.push({
      kind: "notification",
      run: () => (admin ? mailer.send(notificationEmail(data, admin)) : Promise.resolve({ status: "skipped", attempts: 0 })),
    });
  }

  const results = await Promise.all(jobs.map(async (job) => ({ kind: job.kind, result: await job.run() })));
  const now = new Date();
  const set: Record<string, unknown> = {};
  for (const { kind, result } of results) {
    set[`emails.${kind}.status`] = result.status;
    set[`emails.${kind}.lastAttemptAt`] = now;
  }
  await Lead.updateOne(
    { _id: lead._id },
    {
      $set: set,
      $inc: Object.fromEntries(results.map(({ kind, result }) => [`emails.${kind}.attempts`, result.attempts])),
      $push: { activity: { $each: results.map(({ kind, result }) => ({ type: "email", at: now, detail: `${kind} : ${result.status}` })) } },
    },
  );
}

export function createLeadsRouter({ mailer, logger, rateLimit = 5 }: Deps) {
  const router = Router();
  // Formulaire public : 5 envois par quart d'heure et par adresse IP par défaut.
  const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, limit: rateLimit });

  router.post("/", limiter, async (req, res) => {
    const input = leadInputSchema.parse(req.body);

    // Champ piège rempli : réponse neutre, rien n'est enregistré ni envoyé.
    if (input.hp) {
      res.status(202).json({ data: { accepted: true } });
      return;
    }

    assertDatabaseReady();

    // Même soumission renvoyée (double clic, nouvelle tentative) : on renvoie la demande existante.
    const existing = await Lead.findOne({ submissionId: input.submissionId }).select("publicRef");
    if (existing) {
      res.status(200).json({ data: { reference: existing.publicRef, duplicate: true } });
      return;
    }

    const { hp: _hp, consent: _consent, ...fields } = input;
    const now = new Date();
    let lead: LeadDoc | null = null;
    for (let attempt = 0; attempt < 3 && !lead; attempt++) {
      try {
        lead = await Lead.create({
          ...fields,
          publicRef: newPublicRef(),
          consent: { given: true, version: CONSENT_VERSION, at: now },
          activity: [{ type: "created", at: now, detail: "Demande envoyée depuis le formulaire" }],
        });
      } catch (err) {
        const duplicateKey = (err as { code?: number; keyPattern?: Record<string, unknown> }).keyPattern;
        // Collision de référence (très rare) : on retire une nouvelle référence.
        if ((err as { code?: number }).code === 11000 && duplicateKey && "publicRef" in duplicateKey) continue;
        // Course entre deux envois identiques : l'autre a gagné.
        if ((err as { code?: number }).code === 11000 && duplicateKey && "submissionId" in duplicateKey) {
          const winner = await Lead.findOne({ submissionId: input.submissionId }).select("publicRef");
          res.status(200).json({ data: { reference: winner?.publicRef, duplicate: true } });
          return;
        }
        throw err;
      }
    }
    if (!lead) throw new Error("Impossible d'attribuer une référence de demande");

    logger.info({ ref: lead.publicRef, service: lead.serviceType }, "nouvelle demande");

    const delivery = deliverLeadEmails(lead, mailer).catch((err: Error) => {
      logger.error({ ref: lead.publicRef, reason: err.message }, "suivi des emails impossible");
    });
    await Promise.race([delivery, new Promise((resolve) => setTimeout(resolve, EMAIL_WAIT_MS))]);

    res.status(201).json({ data: { reference: lead.publicRef } });
  });

  return router;
}
