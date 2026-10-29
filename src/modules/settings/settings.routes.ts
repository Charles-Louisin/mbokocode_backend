import { Router } from "express";
import { assertDatabaseReady } from "../../db/connection.js";
import { notFound } from "../../utils/errors.js";
import { SiteSettings } from "./settings.model.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  assertDatabaseReady();
  const settings = await SiteSettings.findOne({ key: "site" }).select("-key -createdAt");
  if (!settings) throw notFound("Les réglages du site ne sont pas encore initialisés.");
  res.json({ data: settings.toJSON() });
});
