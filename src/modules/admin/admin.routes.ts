import { Router } from "express";
import type { Logger } from "pino";
import mongoose, { type Document } from "mongoose";
import { assertDatabaseReady } from "../../db/connection.js";
import { notFound } from "../../utils/errors.js";
import { adminEmails } from "../auth/auth.js";
import { currentUser, type SessionGuards } from "../auth/session.js";
import { SiteContent } from "../content/content.model.js";
import { PricingPackage } from "../pricing/pricing.model.js";
import { Service } from "../pricing/service.model.js";
import { Project } from "../projects/project.model.js";
import { Review } from "../reviews/review.model.js";
import { SiteSettings } from "../settings/settings.model.js";
import { deleteUploadedFiles } from "../uploads/uploads.js";
import { AdminActivity } from "./activity.model.js";
import {
  contentUpdateSchema,
  objectId,
  pageQuery,
  pricingUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  serviceUpdateSchema,
  settingsUpdateSchema,
} from "./admin.schema.js";

type Deps = { guards: SessionGuards; adminList: string | undefined; logger: Logger };

// Les clés UploadThing ne sont pas publiques (select: false) : l'admin les relit pour gérer les fichiers.
const WITH_FILE_KEYS = "+coverImage.fileKey +gallery.fileKey";

type MediaLike = { fileKey?: string | null } | null | undefined;
const fileKeysOf = (project: { coverImage?: MediaLike; gallery?: MediaLike[] }) =>
  [project.coverImage?.fileKey, ...(project.gallery ?? []).map((item) => item?.fileKey)].filter((key): key is string => Boolean(key));

/** Applique les champs validés sur un document (null = effacer), puis enregistre avec les validateurs du modèle. */
async function applyAndSave(doc: Document, input: Record<string, unknown>) {
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    doc.set(key, value === null ? undefined : value);
  }
  await doc.save();
  return Object.keys(input).filter((key) => input[key] !== undefined);
}

async function log(actorId: string, action: string, targetType: string, targetId: string, detail?: string) {
  await AdminActivity.create({ actorId, action, targetType, targetId, detail: detail?.slice(0, 300) });
}

/**
 * Tableau de bord : toutes les routes passent par requireAdmin (session + e-mail vérifié dans ADMIN_EMAILS).
 * Chaque modification est journalisée (qui, quoi, quels champs), sans jamais copier le contenu.
 */
export function createAdminRouter({ guards, adminList, logger }: Deps) {
  const router = Router();
  router.use(guards.requireAdmin);
  router.use((_req, _res, next) => {
    assertDatabaseReady();
    next();
  });

  router.get("/overview", async (_req, res) => {
    const users = mongoose.connection.db!.collection("user");
    const [byStatus, projects, publicProjects, offers, services, userCount, activity] = await Promise.all([
      Review.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Project.countDocuments(),
      Project.countDocuments({ visibility: "public" }),
      PricingPackage.countDocuments({ isPublished: true }),
      Service.countDocuments({ isPublished: true }),
      users.countDocuments(),
      AdminActivity.find().sort({ createdAt: -1 }).limit(8),
    ]);
    const reviews = { pending: 0, approved: 0, rejected: 0, hidden: 0 } as Record<string, number>;
    for (const row of byStatus) reviews[row._id] = row.count;
    res.json({
      data: {
        reviews,
        projects: { total: projects, public: publicProjects },
        offers,
        services,
        users: userCount,
        recentActivity: activity.map((item) => item.toJSON()),
      },
    });
  });

  // Projets : tous, y compris privés et non listés.
  router.get("/projects", async (_req, res) => {
    const projects = await Project.find().select(WITH_FILE_KEYS).sort({ sortOrder: 1, createdAt: -1 });
    res.json({ data: projects.map((project) => project.toJSON()) });
  });

  router.post("/projects", async (req, res) => {
    const input = projectCreateSchema.parse(req.body);
    const fields = Object.fromEntries(Object.entries(input).filter(([, value]) => value !== null && value !== undefined));
    const project = await Project.create({ ...fields, publishedAt: new Date() });
    await log(currentUser(res).id, "project.create", "project", project.id as string, project.slug);
    res.status(201).json({ data: project.toJSON() });
  });

  router.patch("/projects/:id", async (req, res) => {
    const { id } = objectId.parse(req.params);
    const input = projectUpdateSchema.parse(req.body);
    const project = await Project.findById(id).select(WITH_FILE_KEYS);
    if (!project) throw notFound("Projet introuvable.");
    const before = fileKeysOf(project.toObject());
    const changed = await applyAndSave(project, input);
    // Images retirées du projet : leurs fichiers sont supprimés d'UploadThing.
    const after = new Set(fileKeysOf(project.toObject()));
    await deleteUploadedFiles(before.filter((key) => !after.has(key)), logger);
    await log(currentUser(res).id, "project.update", "project", id, changed.join(", "));
    res.json({ data: project.toJSON() });
  });

  // Suppression définitive, avec ses images. Pour retirer un projet du site sans le perdre : visibilité « privé ».
  router.delete("/projects/:id", async (req, res) => {
    const { id } = objectId.parse(req.params);
    const project = await Project.findById(id).select(WITH_FILE_KEYS);
    if (!project) throw notFound("Projet introuvable.");
    const keys = fileKeysOf(project.toObject());
    await project.deleteOne();
    await deleteUploadedFiles(keys, logger);
    await log(currentUser(res).id, "project.delete", "project", id, project.slug);
    res.status(204).end();
  });

  // Offres et savoir-faire : mêmes règles, publiées ou non.
  router.get("/pricing", async (_req, res) => {
    const offers = await PricingPackage.find().sort({ sortOrder: 1 });
    res.json({ data: offers.map((offer) => offer.toJSON()) });
  });

  router.patch("/pricing/:id", async (req, res) => {
    const { id } = objectId.parse(req.params);
    const input = pricingUpdateSchema.parse(req.body);
    const offer = await PricingPackage.findById(id);
    if (!offer) throw notFound("Offre introuvable.");
    const changed = await applyAndSave(offer, input);
    await log(currentUser(res).id, "pricing.update", "pricing", id, changed.join(", "));
    res.json({ data: offer.toJSON() });
  });

  router.get("/services", async (_req, res) => {
    const services = await Service.find().sort({ sortOrder: 1 });
    res.json({ data: services.map((service) => service.toJSON()) });
  });

  router.patch("/services/:id", async (req, res) => {
    const { id } = objectId.parse(req.params);
    const input = serviceUpdateSchema.parse(req.body);
    const service = await Service.findById(id);
    if (!service) throw notFound("Savoir-faire introuvable.");
    const changed = await applyAndSave(service, input);
    await log(currentUser(res).id, "service.update", "service", id, changed.join(", "));
    res.json({ data: service.toJSON() });
  });

  // Réglages et contenu éditorial : documents uniques.
  router.get("/settings", async (_req, res) => {
    const settings = await SiteSettings.findOne({ key: "site" });
    if (!settings) throw notFound("Réglages introuvables : lance l'import initial.");
    res.json({ data: settings.toJSON() });
  });

  router.patch("/settings", async (req, res) => {
    const input = settingsUpdateSchema.parse(req.body);
    const settings = await SiteSettings.findOne({ key: "site" });
    if (!settings) throw notFound("Réglages introuvables : lance l'import initial.");
    const changed = await applyAndSave(settings, input);
    await log(currentUser(res).id, "settings.update", "settings", settings.id as string, changed.join(", "));
    res.json({ data: settings.toJSON() });
  });

  router.get("/content", async (_req, res) => {
    const content = await SiteContent.findOne({ key: "site" });
    if (!content) throw notFound("Contenu introuvable : lance l'import initial.");
    res.json({ data: content.toJSON() });
  });

  router.patch("/content", async (req, res) => {
    const input = contentUpdateSchema.parse(req.body);
    const content = await SiteContent.findOne({ key: "site" });
    if (!content) throw notFound("Contenu introuvable : lance l'import initial.");
    const changed = await applyAndSave(content, input);
    await log(currentUser(res).id, "content.update", "content", content.id as string, changed.join(", "));
    res.json({ data: content.toJSON() });
  });

  // Comptes : lecture seule. Le rôle n'est jamais stocké, il se déduit d'ADMIN_EMAILS.
  router.get("/users", async (req, res) => {
    const { page, limit } = pageQuery.parse(req.query);
    const admins = adminEmails({ ADMIN_EMAILS: adminList });
    const users = mongoose.connection.db!.collection("user");
    const [rows, total] = await Promise.all([
      users
        .find({}, { projection: { name: 1, email: 1, emailVerified: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      users.countDocuments(),
    ]);
    res.json({
      data: rows.map((user) => ({
        id: String(user._id),
        name: (user.name as string) || null,
        email: user.email as string,
        emailVerified: Boolean(user.emailVerified),
        isAdmin: Boolean(user.emailVerified) && admins.has(String(user.email).toLowerCase()),
        createdAt: user.createdAt ?? null,
      })),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  });

  router.get("/activity", async (req, res) => {
    const { page, limit } = pageQuery.parse(req.query);
    const [items, total] = await Promise.all([
      AdminActivity.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AdminActivity.countDocuments(),
    ]);
    res.json({ data: items.map((item) => item.toJSON()), meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  });

  return router;
}
