import { Router } from "express";
import { assertDatabaseReady } from "../../db/connection.js";

export const healthRouter = Router();

// Réponse minimale : aucune information de configuration n'est exposée.
healthRouter.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

healthRouter.get("/ready", (_req, res) => {
  assertDatabaseReady();
  res.json({ status: "ready" });
});
