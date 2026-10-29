import { z } from "zod";

const commaList = z.string().transform((value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
    FRONTEND_URL: z.url().default("http://localhost:3000"),
    ALLOWED_ORIGINS: commaList.pipe(z.array(z.url())).default(["http://localhost:3000"]),
    TRUST_PROXY: z.coerce.number().int().min(0).default(0),
    MONGODB_URI: z.string().trim().min(1).optional(),
    MONGODB_DB_NAME: z.string().trim().min(1).default("mbokocode"),
    // Emails transactionnels (Resend). Sans clé, les envois sont marqués « skipped » sans erreur.
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    EMAIL_FROM: z.string().trim().min(3).optional(),
    ADMIN_NOTIFICATION_EMAIL: z.email().optional(),
    // Comptes administrateurs (phase 4). Sert aussi de destinataire des notifications par défaut.
    ADMIN_EMAILS: z.string().trim().max(1000).optional(),
    // Better Auth. Sans secret, la connexion répond 503 : aucun secret par défaut, même en local.
    BETTER_AUTH_SECRET: z.string().trim().min(32).optional(),
    // URL publique où le navigateur joint /api/auth : le site lui-même, qui relaie vers l'API
    // (cookies de session « first-party »). Par défaut : FRONTEND_URL.
    BETTER_AUTH_URL: z.url().optional(),
    GOOGLE_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().trim().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.MONGODB_URI) {
      ctx.addIssue({ code: "custom", path: ["MONGODB_URI"], message: "obligatoire en production" });
    }
    if (env.NODE_ENV === "production" && !env.BETTER_AUTH_SECRET) {
      ctx.addIssue({ code: "custom", path: ["BETTER_AUTH_SECRET"], message: "obligatoire en production" });
    }
    if (Boolean(env.GOOGLE_CLIENT_ID) !== Boolean(env.GOOGLE_CLIENT_SECRET)) {
      ctx.addIssue({ code: "custom", path: ["GOOGLE_CLIENT_SECRET"], message: "GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET vont ensemble" });
    }
  });

export type AppConfig = z.infer<typeof envSchema>;

/**
 * Valide les variables d'environnement. Le message d'erreur cite uniquement
 * les noms des variables en cause, jamais leurs valeurs.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  // Une variable vide dans .env se comporte comme une variable absente.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value.trim() !== ""),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "env"} : ${issue.message}`)
      .join("; ");
    throw new Error(`Configuration invalide — ${details}`);
  }
  return result.data;
}
