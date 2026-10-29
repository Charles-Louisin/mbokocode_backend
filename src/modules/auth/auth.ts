import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { magicLink } from "better-auth/plugins/magic-link";
import mongoose from "mongoose";
import type { Logger } from "pino";
import type { AppConfig } from "../../config/env.js";
import { escapeHtml, type Mailer } from "../../services/email/mailer.js";
import { Review } from "../reviews/review.model.js";

export const AUTH_BASE_PATH = "/api/auth";
const MAGIC_LINK_MINUTES = 10;

/** Adresses d'ADMIN_EMAILS, normalisées. Le rôle admin ne vient que d'ici, jamais du navigateur. */
export function adminEmails(config: Pick<AppConfig, "ADMIN_EMAILS">): Set<string> {
  return new Set(
    (config.ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
  );
}

type AuthDeps = { config: AppConfig; mailer: Mailer; logger: Logger };

function magicLinkEmail(url: string) {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Ton lien de connexion — MBOKO CODE",
    text: [
      "Bonjour,",
      "",
      `Voici ton lien de connexion à MBOKO CODE. Il est valable ${MAGIC_LINK_MINUTES} minutes et ne sert qu'une fois :`,
      url,
      "",
      "Si tu n'as rien demandé, ignore simplement cet email.",
      "— Charles",
    ].join("\n"),
    html: `<p>Bonjour,</p>
<p>Voici ton lien de connexion à MBOKO CODE. Il est valable ${MAGIC_LINK_MINUTES} minutes et ne sert qu'une fois.</p>
<p><a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#2f54ff;color:#ffffff;border-radius:999px;text-decoration:none">Me connecter</a></p>
<p style="color:#6b7590;font-size:13px">Si tu n'as rien demandé, ignore simplement cet email.<br>— Charles</p>`,
  };
}

/**
 * Better Auth sur la base MongoDB déjà ouverte par Mongoose.
 * Connexion Google (si les identifiants sont fournis) et lien email à usage unique via Resend.
 * Pas de mot de passe : aucun secret utilisateur n'est stocké par l'application.
 */
export function createAuth({ config, mailer, logger }: AuthDeps) {
  // Même base que Mongoose : comptes, sessions et contenus vivent ensemble.
  const db = mongoose.connection.db!;
  const google =
    config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: config.GOOGLE_CLIENT_ID, clientSecret: config.GOOGLE_CLIENT_SECRET, prompt: "select_account" as const } }
      : {};

  return betterAuth({
    appName: "MBOKO CODE",
    baseURL: config.BETTER_AUTH_URL ?? config.FRONTEND_URL,
    basePath: AUTH_BASE_PATH,
    secret: config.BETTER_AUTH_SECRET,
    // Sans client : pas de transactions, compatibles avec un serveur MongoDB autonome comme avec Atlas.
    database: mongodbAdapter(db),
    trustedOrigins: config.ALLOWED_ORIGINS,
    socialProviders: google,
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    user: {
      // Suppression du compte par son titulaire (session récente exigée par Better Auth) :
      // son avis part avec lui.
      deleteUser: {
        enabled: true,
        beforeDelete: async (user) => {
          await Review.deleteMany({ userId: user.id });
        },
      },
    },
    rateLimit: {
      enabled: config.NODE_ENV !== "test",
      window: 60,
      max: 60,
      customRules: { "/sign-in/magic-link": { window: 15 * 60, max: 5 }, "/sign-in/social": { window: 60, max: 10 } },
    },
    advanced: {
      useSecureCookies: config.NODE_ENV === "production",
      // Les adresses IP ne sont lues que derrière un proxy déclaré, comme pour Express.
      ipAddress: { ipAddressHeaders: config.TRUST_PROXY > 0 ? ["x-forwarded-for"] : [], disableIpTracking: config.TRUST_PROXY === 0 },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_MINUTES * 60,
        storeToken: "hashed",
        async sendMagicLink({ email, url }) {
          const message = magicLinkEmail(url);
          // Clé aléatoire : rien du jeton ne part dans les logs du service d'email.
          const result = await mailer.send({ to: email, ...message, idempotencyKey: `magic-${randomUUID()}` });
          if (result.status === "sent") return;
          if (config.NODE_ENV === "development") {
            // Local uniquement : le lien est affiché pour pouvoir tester la connexion même si l'e-mail ne part pas
            // (Resend absent, ou expéditeur de test @resend.dev qui ne livre qu'au propriétaire du compte Resend).
            logger.warn(`Lien de connexion (local, e-mail ${result.status === "skipped" ? "non configuré" : "refusé par Resend"}) : ${url}`);
            if (result.status === "skipped") return;
          }
          throw new Error("magic-link email not sent");
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
