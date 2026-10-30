import { randomInt } from "node:crypto";
import { type InferSchemaType, Schema, model } from "mongoose";
import { publicJson } from "../../db/json.js";
import { BUDGETS, DEADLINES, FEATURES, keysOf, LEAD_STATUSES, SERVICE_TYPES } from "./lead.options.js";

// Alphabet sans caractères ambigus (0/O, 1/I/L) : la référence se dicte au téléphone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Référence publique non séquentielle, par exemple « MB-7K3QX9 ». */
export function newPublicRef(): string {
  let ref = "";
  for (let i = 0; i < 6; i++) ref += ALPHABET[randomInt(ALPHABET.length)];
  return `MB-${ref}`;
}

const deliverySchema = new Schema(
  {
    status: { type: String, enum: ["pending", "sent", "failed", "skipped"], default: "pending" },
    attempts: { type: Number, default: 0 },
    lastAttemptAt: { type: Date },
  },
  { _id: false },
);

const activitySchema = new Schema(
  {
    type: { type: String, required: true, enum: ["created", "status", "email", "note"] },
    at: { type: Date, default: () => new Date() },
    // Résumé court et non sensible, jamais le contenu d'un message.
    detail: { type: String, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const leadSchema = new Schema(
  {
    publicRef: { type: String, required: true, unique: true },
    // Identifiant généré par le formulaire : une même soumission renvoyée ne crée pas de doublon.
    submissionId: { type: String, required: true, unique: true },

    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    whatsapp: { type: String, trim: true, maxlength: 20 },
    company: { type: String, trim: true, maxlength: 120 },
    website: { type: String, trim: true, maxlength: 300 },

    serviceType: { type: String, required: true, enum: keysOf(SERVICE_TYPES) },
    goal: { type: String, required: true, trim: true, maxlength: 3000 },
    features: { type: [{ type: String, enum: keysOf(FEATURES) }], default: [] },
    constraints: { type: String, trim: true, maxlength: 1500 },
    budget: { type: String, enum: keysOf(BUDGETS) },
    currency: { type: String, default: "XAF", match: /^[A-Z]{3}$/ },
    deadline: { type: String, enum: keysOf(DEADLINES) },

    sourcePage: { type: String, trim: true, maxlength: 200 },
    utm: {
      source: { type: String, trim: true, maxlength: 100 },
      medium: { type: String, trim: true, maxlength: 100 },
      campaign: { type: String, trim: true, maxlength: 100 },
    },

    status: { type: String, enum: [...LEAD_STATUSES], default: "new" },
    consent: {
      given: { type: Boolean, required: true },
      version: { type: String, required: true },
      at: { type: Date, required: true },
    },
    internalNotes: { type: [{ text: String, at: Date }], default: [], select: false },
    activity: { type: [activitySchema], default: [] },
    emails: {
      confirmation: { type: deliverySchema, default: () => ({}) },
      notification: { type: deliverySchema, default: () => ({}) },
    },
  },
  { timestamps: true, toJSON: publicJson },
);

leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ email: 1, createdAt: -1 });

export type LeadData = InferSchemaType<typeof leadSchema>;
export const Lead = model("Lead", leadSchema);
