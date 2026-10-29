import { type InferSchemaType, Schema, model } from "mongoose";
import { publicJson, SLUG_PATTERN } from "../../db/json.js";

export const PROJECT_CATEGORIES = ["web", "mobile", "platform", "experience"] as const;
export const PROJECT_STATUSES = ["prototype", "in_progress", "deployed", "maintained", "archived"] as const;
export const PROJECT_VISIBILITIES = ["public", "unlisted", "private"] as const;

export const mediaSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 500 },
    alt: { type: String, required: true, trim: true, maxlength: 200 },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    // Clé UploadThing, pour supprimer le fichier quand il devient orphelin.
    fileKey: { type: String, trim: true, select: false },
  },
  { _id: false },
);

// Uniquement des indicateurs vérifiés par le propriétaire.
const metricSchema = new Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 40 },
  },
  { _id: false },
);

const projectSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: SLUG_PATTERN },
    kicker: { type: String, trim: true, maxlength: 80 },
    shortDescription: { type: String, required: true, trim: true, maxlength: 280 },
    description: { type: String, trim: true, maxlength: 4000 },
    category: { type: String, enum: [...PROJECT_CATEGORIES], required: true },
    tags: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
    status: { type: String, enum: [...PROJECT_STATUSES], required: true },
    visibility: { type: String, enum: [...PROJECT_VISIBILITIES], default: "private" },

    roleAndContribution: { type: String, trim: true, maxlength: 1500 },
    context: { type: String, trim: true, maxlength: 3000 },
    challenge: { type: String, trim: true, maxlength: 3000 },
    solution: { type: String, trim: true, maxlength: 4000 },
    features: { type: [String], default: [] },
    decisions: { type: [String], default: [] },
    results: { type: String, trim: true, maxlength: 3000 },
    metrics: { type: [metricSchema], default: [] },
    lessonsLearned: { type: String, trim: true, maxlength: 3000 },
    futureImprovements: { type: String, trim: true, maxlength: 3000 },

    coverImage: { type: mediaSchema },
    gallery: { type: [mediaSchema], default: [] },
    demoVideo: { type: String, trim: true, maxlength: 500 },
    liveUrl: { type: String, trim: true, maxlength: 500 },
    repositoryUrl: { type: String, trim: true, maxlength: 500 },
    licenseAvailable: { type: Boolean, default: false },

    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 100 },
    publishedAt: { type: Date },

    seoTitle: { type: String, trim: true, maxlength: 70 },
    seoDescription: { type: String, trim: true, maxlength: 160 },
    ogImage: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, toJSON: publicJson },
);

projectSchema.index({ visibility: 1, publishedAt: -1 });
projectSchema.index({ visibility: 1, category: 1, sortOrder: 1 });
projectSchema.index({ visibility: 1, isFeatured: 1, sortOrder: 1 });

export type ProjectData = InferSchemaType<typeof projectSchema>;
export const Project = model("Project", projectSchema);
