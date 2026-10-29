import { Router } from "express";
import type { Logger } from "pino";
import { assertDatabaseReady } from "../../db/connection.js";
import { createRateLimiter } from "../../middleware/rate-limit.js";
import { escapeHtml, type Mailer } from "../../services/email/mailer.js";
import { AppError, notFound } from "../../utils/errors.js";
import { currentUser, type SessionGuards } from "../auth/session.js";
import { Project } from "../projects/project.model.js";
import { OWNER_FIELDS, PUBLIC_FIELDS, Review } from "./review.model.js";
import { objectIdParamSchema, reviewCreateSchema, reviewListQuerySchema, reviewUpdateSchema } from "./review.schema.js";

type Deps = { guards: SessionGuards; mailer: Mailer; logger: Logger; /** Écritures par compte et par heure. */ writeLimit?: number };

type ReviewDoc = InstanceType<typeof Review>;

/** Forme publique d'un avis : nom affiché, note, texte, badge et date. */
export function toPublicReview(review: ReviewDoc) {
  return {
    id: review.id as string,
    authorName: review.authorNameSnapshot,
    authorRole: review.authorRole ?? null,
    rating: review.rating,
    title: review.title ?? null,
    content: review.content,
    relationshipType: review.relationshipType ?? null,
    projectSlug: review.projectSlug ?? null,
    isVerifiedClient: review.isVerifiedClient,
    publishedAt: review.publishedAt ?? null,
  };
}

function toOwnerReview(review: ReviewDoc) {
  return { ...toPublicReview(review), status: review.status, createdAt: review.get("createdAt"), updatedAt: review.get("updatedAt") };
}

async function assertKnownProject(slug: string | undefined) {
  if (!slug) return;
  const exists = await Project.exists({ slug, visibility: "public" });
  if (!exists) throw new AppError(400, "VALIDATION_ERROR", "Projet inconnu.", { projectSlug: ["Projet inconnu."] });
}

function notifyPendingReview(review: ReviewDoc, mailer: Mailer, logger: Logger, kind: "nouvel" | "modifié") {
  const admin = mailer.adminEmail;
  if (!admin) return;
  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);
  const name = review.authorNameSnapshot;
  void mailer
    .send({
      to: admin,
      subject: `Avis ${kind} à modérer — ${stars}`,
      text: `Avis ${kind} de ${name} (${stars}), en attente de modération.\n\n${review.content}`,
      html: `<p>Avis ${kind} de <strong>${escapeHtml(name)}</strong> (${stars}), en attente de modération.</p><blockquote>${escapeHtml(review.content)}</blockquote>`,
      idempotencyKey: `review-${review.id as string}-${(review.get("updatedAt") as Date).getTime()}`,
    })
    .catch((err: Error) => logger.warn({ review: review.id as string, reason: err.message }, "notification d'avis impossible"));
}

export function createReviewsRouter({ guards, mailer, logger, writeLimit = 10 }: Deps) {
  const router = Router();
  // Limite par compte connecté (et non par IP) : création, modification, suppression.
  const writeLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    limit: writeLimit,
    keyGenerator: (req) => `review:${(req.res?.locals.user as { id: string } | undefined)?.id ?? "anon"}`,
  });

  // Public : uniquement les avis approuvés, du plus récent au plus ancien.
  router.get("/", async (req, res) => {
    const query = reviewListQuerySchema.parse(req.query);
    assertDatabaseReady();
    const filter = { status: "approved" as const };
    const [items, total, stats] = await Promise.all([
      Review.find(filter)
        .select(PUBLIC_FIELDS)
        .sort({ publishedAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      Review.countDocuments(filter),
      Review.aggregate<{ average: number }>([{ $match: filter }, { $group: { _id: null, average: { $avg: "$rating" } } }]),
    ]);
    res.json({
      data: items.map((item) => toPublicReview(item as ReviewDoc)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
        averageRating: stats[0] ? Math.round(stats[0].average * 10) / 10 : null,
      },
    });
  });

  router.get("/me", guards.requireUser, async (_req, res) => {
    assertDatabaseReady();
    const review = await Review.findOne({ userId: currentUser(res).id }).select(OWNER_FIELDS);
    res.json({ data: review ? toOwnerReview(review as ReviewDoc) : null });
  });

  router.post("/", guards.requireUser, writeLimiter, async (req, res) => {
    const input = reviewCreateSchema.parse(req.body);
    assertDatabaseReady();
    const user = currentUser(res);
    await assertKnownProject(input.projectSlug);

    const { authorName, consent: _consent, ...fields } = input;
    let review: ReviewDoc;
    try {
      review = await Review.create({
        ...fields,
        userId: user.id,
        authorNameSnapshot: authorName,
        status: "pending",
        consentAt: new Date(),
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) {
        throw new AppError(409, "CONFLICT", "Tu as déjà laissé un avis. Tu peux le modifier depuis ton compte.");
      }
      throw err;
    }
    logger.info({ review: review.id as string }, "nouvel avis en attente");
    notifyPendingReview(review, mailer, logger, "nouvel");
    res.status(201).json({ data: toOwnerReview(review) });
  });

  // Toute modification repasse l'avis en modération : un avis publié ne change pas sans relecture.
  router.patch("/:id", guards.requireUser, writeLimiter, async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const input = reviewUpdateSchema.parse(req.body);
    assertDatabaseReady();
    await assertKnownProject(input.projectSlug);

    const { authorName, ...fields } = input;
    const review = await Review.findOne({ _id: id, userId: currentUser(res).id });
    // Avis d'un autre compte : même réponse qu'un avis inexistant.
    if (!review) throw notFound("Avis introuvable.");
    review.set({ ...fields, ...(authorName ? { authorNameSnapshot: authorName } : {}), status: "pending", publishedAt: undefined });
    await review.save();
    notifyPendingReview(review, mailer, logger, "modifié");
    res.json({ data: toOwnerReview(review) });
  });

  // Suppression immédiate et définitive par son auteur.
  router.delete("/:id", guards.requireUser, writeLimiter, async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    assertDatabaseReady();
    const result = await Review.deleteOne({ _id: id, userId: currentUser(res).id });
    if (result.deletedCount === 0) throw notFound("Avis introuvable.");
    res.status(204).end();
  });

  return router;
}
