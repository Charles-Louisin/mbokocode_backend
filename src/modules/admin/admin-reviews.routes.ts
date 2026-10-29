import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { assertDatabaseReady } from "../../db/connection.js";
import { notFound } from "../../utils/errors.js";
import { currentUser, type SessionGuards } from "../auth/session.js";
import { REVIEW_STATUSES, Review } from "../reviews/review.model.js";
import { objectIdParamSchema } from "../reviews/review.schema.js";
import { AdminActivity } from "./activity.model.js";

const listQuerySchema = z
  .object({
    status: z.enum(REVIEW_STATUSES).optional(),
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

const moderationSchema = z
  .object({
    status: z.enum(["approved", "rejected", "hidden"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

// Le badge « Client vérifié » exige une justification : comment la collaboration a été vérifiée.
const verificationSchema = z
  .object({
    isVerifiedClient: z.boolean(),
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((value) => !value.isVerifiedClient || (value.note?.length ?? 0) >= 5, {
    message: "Explique comment la collaboration a été vérifiée.",
    path: ["note"],
  });

type ReviewDoc = InstanceType<typeof Review>;

const toAdminReview = (review: ReviewDoc) => review.toJSON();

/** Modération des avis : toutes les routes passent par requireAdmin. */
export function createAdminReviewsRouter({ guards }: { guards: SessionGuards }) {
  const router = Router();
  router.use(guards.requireAdmin);

  router.get("/", async (req, res) => {
    const query = listQuerySchema.parse(req.query);
    assertDatabaseReady();
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    const [items, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit),
      Review.countDocuments(filter),
    ]);
    // E-mail de l'auteur (compte Better Auth), visible de l'admin seul : utile pour vérifier un client.
    const ids = [...new Set(items.map((item) => item.userId))].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const accounts = await mongoose.connection
      .db!.collection("user")
      .find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }, { projection: { email: 1 } })
      .toArray();
    const emails = new Map(accounts.map((account) => [String(account._id), account.email as string]));
    res.json({
      data: items.map((item) => ({ ...toAdminReview(item), authorEmail: emails.get(item.userId) ?? null })),
      meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
    });
  });

  router.patch("/:id/status", async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const input = moderationSchema.parse(req.body);
    assertDatabaseReady();
    const review = await Review.findById(id);
    if (!review) throw notFound("Avis introuvable.");

    const now = new Date();
    review.set({
      status: input.status,
      moderationNote: input.note || undefined,
      moderatedAt: now,
      // Date de publication posée à la première approbation, retirée si l'avis n'est plus visible.
      publishedAt: input.status === "approved" ? (review.publishedAt ?? now) : undefined,
    });
    await review.save();
    await AdminActivity.create({
      actorId: currentUser(res).id,
      action: `review.${input.status}`,
      targetType: "review",
      targetId: review.id as string,
    });
    res.json({ data: toAdminReview(review) });
  });

  router.patch("/:id/verification", async (req, res) => {
    const { id } = objectIdParamSchema.parse(req.params);
    const input = verificationSchema.parse(req.body);
    assertDatabaseReady();
    const review = await Review.findById(id);
    if (!review) throw notFound("Avis introuvable.");

    const admin = currentUser(res);
    review.set({
      isVerifiedClient: input.isVerifiedClient,
      verification: input.isVerifiedClient ? { note: input.note, at: new Date(), by: admin.id } : undefined,
    });
    await review.save();
    await AdminActivity.create({
      actorId: admin.id,
      action: input.isVerifiedClient ? "review.verify" : "review.unverify",
      targetType: "review",
      targetId: review.id as string,
      detail: input.note?.slice(0, 300),
    });
    res.json({ data: toAdminReview(review) });
  });

  return router;
}
