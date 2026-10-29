import { Schema, model } from "mongoose";
import { publicJson } from "../../db/json.js";

const activitySchema = new Schema(
  {
    actorId: { type: String, required: true },
    action: { type: String, required: true, maxlength: 60 },
    targetType: { type: String, required: true, maxlength: 30 },
    targetId: { type: String, required: true },
    // Résumé court, jamais de jeton, cookie ni contenu complet.
    detail: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: publicJson },
);
activitySchema.index({ createdAt: -1 });

/** Journal des actions administratives sensibles. */
export const AdminActivity = model("AdminActivity", activitySchema);
