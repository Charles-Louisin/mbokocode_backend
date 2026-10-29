import { type InferSchemaType, Schema, model } from "mongoose";
import { publicJson } from "../../db/json.js";

// Document unique (clé « site ») pour les réglages éditoriaux. Jamais de secret ici.
const siteSettingsSchema = new Schema(
  {
    key: { type: String, default: "site", unique: true, immutable: true },
    publicName: { type: String, required: true, trim: true, maxlength: 60 },
    ownerName: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, trim: true, maxlength: 80 },
    tagline: { type: String, trim: true, maxlength: 280 },
    location: { type: String, trim: true, maxlength: 80 },
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    // Format wa.me : indicatif pays + numéro, chiffres uniquement.
    whatsappNumber: { type: String, trim: true, match: /^\d{8,15}$/ },
    cvUrl: { type: String, trim: true, maxlength: 300 },
    socials: {
      type: [
        new Schema(
          {
            label: { type: String, required: true, trim: true, maxlength: 40 },
            url: { type: String, required: true, trim: true, maxlength: 300 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    availability: {
      isAvailable: { type: Boolean, default: false },
      label: { type: String, trim: true, maxlength: 120 },
    },
    currency: { type: String, default: "EUR", uppercase: true, match: /^[A-Z]{3}$/ },
    seo: {
      title: { type: String, trim: true, maxlength: 70 },
      description: { type: String, trim: true, maxlength: 160 },
    },
    features: {
      reviews: { type: Boolean, default: false },
      lab: { type: Boolean, default: true },
      journal: { type: Boolean, default: false },
    },
  },
  { timestamps: true, toJSON: publicJson },
);

export type SiteSettingsData = InferSchemaType<typeof siteSettingsSchema>;
export const SiteSettings = model("SiteSettings", siteSettingsSchema);
