import { type InferSchemaType, Schema, model } from "mongoose";
import { publicJson, SLUG_PATTERN } from "../../db/json.js";

const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: SLUG_PATTERN },
    summary: { type: String, required: true, trim: true, maxlength: 400 },
    audience: { type: String, trim: true, maxlength: 600 },
    problem: { type: String, trim: true, maxlength: 1000 },
    deliverables: { type: [String], default: [] },
    scope: { type: String, trim: true, maxlength: 1500 },
    exclusions: { type: [String], default: [] },
    clientDependencies: { type: [String], default: [] },
    deliveryEstimate: { type: String, trim: true, maxlength: 80 },
    collaborationMode: { type: String, trim: true, maxlength: 600 },
    // Slugs des projets publiés qui prouvent ce savoir-faire.
    proofs: { type: [String], default: [] },
    isPublished: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 100 },
  },
  { timestamps: true, toJSON: publicJson },
);

serviceSchema.index({ isPublished: 1, sortOrder: 1 });

export type ServiceData = InferSchemaType<typeof serviceSchema>;
export const Service = model("Service", serviceSchema);
