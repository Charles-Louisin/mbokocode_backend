import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { AppError, type ErrorBody, notFound } from "../utils/errors.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(notFound("Cette route n'existe pas."));
};

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof z.ZodError) {
    return new AppError(400, "VALIDATION_ERROR", "Vérifie les champs indiqués.", z.flattenError(err).fieldErrors);
  }

  // Erreurs levées par express.json() (body-parser).
  const type = (err as { type?: string } | null)?.type;
  if (type === "entity.too.large") return new AppError(413, "PAYLOAD_TOO_LARGE", "La requête est trop volumineuse.");
  if (type === "entity.parse.failed") return new AppError(400, "BAD_REQUEST", "Le corps de la requête est invalide.");

  const name = (err as { name?: string } | null)?.name;
  // Règles des modèles Mongoose (ex. fourchette de prix incohérente) : message par champ, sans détail interne.
  if (name === "ValidationError") {
    const errors = (err as { errors?: Record<string, { message?: string }> }).errors ?? {};
    const fieldErrors = Object.fromEntries(Object.entries(errors).map(([path, value]) => [path, [value.message ?? "Valeur invalide."]]));
    return new AppError(400, "VALIDATION_ERROR", "Vérifie les champs indiqués.", fieldErrors);
  }
  if ((err as { code?: number } | null)?.code === 11000) {
    return new AppError(409, "CONFLICT", "Cette valeur est déjà utilisée (identifiant en double).");
  }
  if (name === "MongooseServerSelectionError" || name === "MongoNetworkError") {
    return new AppError(503, "SERVICE_UNAVAILABLE", "Service momentanément indisponible. Réessaie dans un instant.");
  }

  return new AppError(500, "INTERNAL_ERROR", "Une erreur inattendue est survenue.");
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = toAppError(err);
  if (appError.code === "INTERNAL_ERROR") {
    // L'erreur d'origine reste dans les logs serveur, jamais dans la réponse.
    req.log.error({ err }, "request failed");
  }

  const body: ErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.fieldErrors ? { fieldErrors: appError.fieldErrors } : {}),
    },
    requestId: String(req.id),
  };
  res.status(appError.status).json(body);
};
