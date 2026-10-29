import { type InferSchemaType, Schema, model } from "mongoose";
import { publicJson, SLUG_PATTERN } from "../../db/json.js";

export const REVIEW_STATUSES = ["pending", "approved", "rejected", "hidden"] as const;
export const RELATIONSHIP_TYPES = ["client", "collaboration", "other"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const reviewSchema = new Schema(
  {
    // Identifiant Better Auth de l'auteur. Règle anti-doublon : un seul avis par compte (index unique),
    // que l'auteur peut modifier ou supprimer.
    userId: { type: String, required: true, unique: true },
    authorNameSnapshot: { type: String, required: true, trim: true, maxlength: 60 },
    authorRole: { type: String, trim: true, maxlength: 80 },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 80 },
    content: { type: String, required: true, trim: true, minlength: 30, maxlength: 1200 },
    relationshipType: { type: String, enum: RELATIONSHIP_TYPES },
    projectSlug: { type: String, trim: true, match: SLUG_PATTERN, maxlength: 100 },

    status: { type: String, enum: REVIEW_STATUSES, default: "pending" },
    // Ni l'auteur ni la connexion ne décident de ces champs : seul l'admin, avec une justification.
    isVerifiedClient: { type: Boolean, default: false },
    verification: {
      note: { type: String, trim: true, maxlength: 300 },
      at: { type: Date },
      by: { type: String },
    },
    moderationNote: { type: String, trim: true, maxlength: 500 },
    moderatedAt: { type: Date },
    publishedAt: { type: Date },
    source: { type: String, enum: ["spontaneous", "invitation"], default: "spontaneous" },
    // Accord de publication donné par l'auteur, horodaté.
    consentAt: { type: Date, required: true },
  },
  { timestamps: true, toJSON: publicJson },
);

reviewSchema.index({ status: 1, publishedAt: -1 });
reviewSchema.index({ status: 1, createdAt: -1 });

export type ReviewData = InferSchemaType<typeof reviewSchema>;
export const Review = model("Review", reviewSchema);

/** Champs visibles du public : ni identifiant de compte, ni notes de modération. */
export const PUBLIC_FIELDS = "authorNameSnapshot authorRole rating title content relationshipType projectSlug isVerifiedClient publishedAt";
/** Champs visibles de l'auteur : son avis et son état, sans la note interne de modération. */
export const OWNER_FIELDS = `${PUBLIC_FIELDS} status createdAt updatedAt`;
