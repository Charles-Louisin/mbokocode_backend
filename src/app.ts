import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { toNodeHandler } from "better-auth/node";
import type { AppConfig } from "./config/env.js";
import { isDatabaseReady } from "./db/connection.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { createRateLimiter } from "./middleware/rate-limit.js";
import { createAdminReviewsRouter } from "./modules/admin/admin-reviews.routes.js";
import { createAdminRouter } from "./modules/admin/admin.routes.js";
import { AUTH_BASE_PATH, type Auth, createAuth } from "./modules/auth/auth.js";
import { contentRouter } from "./modules/content/content.routes.js";
import { currentUser, createSessionGuards } from "./modules/auth/session.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { createLeadsRouter } from "./modules/leads/leads.routes.js";
import { pricingRouter, servicesRouter } from "./modules/pricing/pricing.routes.js";
import { createReviewsRouter } from "./modules/reviews/reviews.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { createUploadsHandler, UPLOADS_PATH } from "./modules/uploads/uploads.js";
import { createResendMailer, type Mailer } from "./services/email/mailer.js";
import { AppError } from "./utils/errors.js";

export const JSON_BODY_LIMIT = "100kb";

type AppDeps = { mailer?: Mailer; leadsRateLimit?: number; reviewsWriteLimit?: number };

export function createApp(config: AppConfig, logger: Logger, deps: AppDeps = {}) {
  const mailer = deps.mailer ?? createResendMailer(config, logger);
  // Better Auth est créé à la première requête, une fois MongoDB connecté et le secret fourni.
  let auth: Auth | null = null;
  let authHandler: ReturnType<typeof toNodeHandler> | null = null;
  const getAuth = () => {
    if (!auth && config.BETTER_AUTH_SECRET && isDatabaseReady()) {
      auth = createAuth({ config, mailer, logger });
      authHandler = toNodeHandler(auth);
    }
    return auth;
  };
  const guards = createSessionGuards(getAuth, config);

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.TRUST_PROXY);

  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader("X-Request-Id", id);
        return id;
      },
      // Seuls la méthode, le chemin et le statut sont journalisés : ni en-têtes, ni corps.
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
      autoLogging: { ignore: (req) => req.url === "/api/v1/health" },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      // Liste blanche explicite ; une origine inconnue ne reçoit aucun en-tête CORS.
      origin: (origin, callback) => callback(null, !origin || config.ALLOWED_ORIGINS.includes(origin)),
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      maxAge: 600,
    }),
  );
  // Better Auth lit lui-même le corps de ses requêtes : monté avant express.json (Express 5 : *splat).
  app.all(`${AUTH_BASE_PATH}/*splat`, (req, res, next) => {
    if (!getAuth() || !authHandler) {
      next(new AppError(503, "SERVICE_UNAVAILABLE", "La connexion est momentanément indisponible."));
      return;
    }
    void authHandler(req, res);
  });
  // UploadThing lit lui aussi son propre corps de requête. Sans jeton, la route répond 503.
  if (process.env.UPLOADTHING_TOKEN) {
    app.use(UPLOADS_PATH, createUploadsHandler(config, guards));
  } else {
    app.use(UPLOADS_PATH, (_req, _res, next) => next(new AppError(503, "SERVICE_UNAVAILABLE", "L'envoi d'images n'est pas configuré.")));
  }
  app.use(express.json({ limit: JSON_BODY_LIMIT }));

  const api = Router();
  api.use(createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 300 }));
  api.use(healthRouter);
  api.use("/projects", projectsRouter);
  api.use("/services", servicesRouter);
  api.use("/pricing", pricingRouter);
  api.use("/settings", settingsRouter);
  api.use("/content", contentRouter);
  api.use("/leads", createLeadsRouter({ mailer, logger, rateLimit: deps.leadsRateLimit }));
  api.use("/reviews", createReviewsRouter({ guards, mailer, logger, writeLimit: deps.reviewsWriteLimit }));
  // Méthodes de connexion réellement disponibles, pour n'afficher que des boutons qui marchent.
  api.get("/auth/providers", (_req, res) => {
    const ready = Boolean(config.BETTER_AUTH_SECRET) && isDatabaseReady();
    res.json({
      data: {
        google: ready && Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
        // Sans Resend, le lien n'est utilisable qu'en local (affiché dans le terminal de l'API).
        magicLink: ready && (mailer.enabled || config.NODE_ENV === "development"),
      },
    });
  });
  // Profil minimal du compte connecté : le statut admin est calculé ici, jamais envoyé par le navigateur.
  api.get("/me", guards.requireUser, (_req, res) => {
    res.json({ data: currentUser(res) });
  });
  api.use("/admin/reviews", createAdminReviewsRouter({ guards }));
  api.use("/admin", createAdminRouter({ guards, adminList: config.ADMIN_EMAILS, logger }));
  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
