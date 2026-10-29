import type { Request } from "express";
import { rateLimit } from "express-rate-limit";
import { AppError } from "../utils/errors.js";

type LimitOptions = {
  windowMs: number;
  limit: number;
  /** Clé de limitation ; par défaut l'adresse IP. Ex. : l'identifiant du compte connecté. */
  keyGenerator?: (req: Request) => string;
};

export function createRateLimiter({ windowMs, limit, keyGenerator }: LimitOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(keyGenerator ? { keyGenerator } : {}),
    handler: (_req, _res, next) => {
      next(new AppError(429, "RATE_LIMITED", "Trop de requêtes. Réessaie dans quelques minutes."));
    },
  });
}
