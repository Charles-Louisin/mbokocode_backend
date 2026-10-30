import { type InferSchemaType, Schema, model } from "mongoose";
import { publicJson, SLUG_PATTERN } from "../../db/json.js";

export const PRICE_TYPES = ["fixed", "from", "range", "quote"] as const;

const pricingPackageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, match: SLUG_PATTERN },
    kicker: { type: String, trim: true, maxlength: 40 },
    description: { type: String, required: true, trim: true, maxlength: 400 },
    priceType: { type: String, enum: [...PRICE_TYPES], required: true },
    currency: { type: String, default: "XAF", uppercase: true, match: /^[A-Z]{3}$/ },
    // Montants ×100 (centimes, quelle que soit la devise) pour éviter les arrondis flottants.
    priceMin: { type: Number, min: 0, validate: Number.isInteger },
    priceMax: { type: Number, min: 0, validate: Number.isInteger },
    features: { type: [String], default: [] },
    deliveryEstimate: { type: String, trim: true, maxlength: 80 },
    serviceType: { type: String, trim: true, maxlength: 40 },
    isPublished: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 100 },
  },
  { timestamps: true, toJSON: publicJson },
);

type PriceCheck = {
  priceType: (typeof PRICE_TYPES)[number];
  priceMin?: number | null;
  priceMax?: number | null;
  invalidate(path: string, message: string): unknown;
};

pricingPackageSchema.pre("validate", function (this: PriceCheck) {
  const needsMin = this.priceType !== "quote";
  if (needsMin && this.priceMin == null) {
    this.invalidate("priceMin", "Prix minimum requis pour ce type d'offre.");
  }
  if (this.priceType === "range" && (this.priceMax == null || this.priceMax < (this.priceMin ?? 0))) {
    this.invalidate("priceMax", "La fourchette doit avoir un maximum supérieur au minimum.");
  }
});

pricingPackageSchema.index({ isPublished: 1, sortOrder: 1 });

export type PricingPackageData = InferSchemaType<typeof pricingPackageSchema>;
export const PricingPackage = model("PricingPackage", pricingPackageSchema);
