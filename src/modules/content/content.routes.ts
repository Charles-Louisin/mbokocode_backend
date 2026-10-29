import { Router } from "express";
import { assertDatabaseReady } from "../../db/connection.js";
import { notFound } from "../../utils/errors.js";
import { SiteContent } from "./content.model.js";

export const contentRouter = Router();

contentRouter.get("/", async (_req, res) => {
  assertDatabaseReady();
  const content = await SiteContent.findOne({ key: "site" }).select("-key -createdAt");
  if (!content) throw notFound("Le contenu du site n'est pas encore initialisé.");
  res.json({ data: content.toJSON() });
});
