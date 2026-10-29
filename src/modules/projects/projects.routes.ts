import { Router } from "express";
import { trusted } from "mongoose";
import { z } from "zod";
import { assertDatabaseReady } from "../../db/connection.js";
import { SLUG_PATTERN } from "../../db/json.js";
import { notFound } from "../../utils/errors.js";
import { PROJECT_CATEGORIES, Project } from "./project.model.js";

const LIST_FIELDS =
  "title slug kicker shortDescription category technologies status coverImage liveUrl isFeatured licenseAvailable sortOrder publishedAt";

const listQuerySchema = z
  .object({
    category: z.enum(PROJECT_CATEGORIES).optional(),
    featured: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(12),
  })
  // Paramètre inconnu (y compris « category[$ne] ») → 400 plutôt qu'ignoré en silence.
  .strict();

export const slugParamSchema = z.object({ slug: z.string().max(100).regex(SLUG_PATTERN) });

export const projectsRouter = Router();

projectsRouter.get("/", async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  assertDatabaseReady();

  // Filtre construit champ par champ : aucune donnée du client n'est passée telle quelle.
  // `trusted()` marque nos propres opérateurs, que sanitizeFilter neutraliserait sinon.
  const filter: Record<string, unknown> = { visibility: "public", publishedAt: trusted({ $lte: new Date() }) };
  if (query.category) filter.category = query.category;
  if (query.featured !== undefined) filter.isFeatured = query.featured;

  const [items, total] = await Promise.all([
    Project.find(filter)
      .select(LIST_FIELDS)
      .sort({ sortOrder: 1, publishedAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit),
    Project.countDocuments(filter),
  ]);

  res.json({
    data: items.map((item) => item.toJSON()),
    meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  });
});

projectsRouter.get("/:slug", async (req, res) => {
  const { slug } = slugParamSchema.parse(req.params);
  assertDatabaseReady();

  // Un projet « unlisted » reste accessible par son lien direct, sans apparaître dans la liste.
  const project = await Project.findOne({
    slug,
    visibility: trusted({ $in: ["public", "unlisted"] }),
    publishedAt: trusted({ $lte: new Date() }),
  }).select("-visibility");

  if (!project) throw notFound("Ce projet n'existe pas ou n'est pas publié.");
  res.json({ data: project.toJSON() });
});
