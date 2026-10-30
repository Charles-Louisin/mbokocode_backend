import { z } from "zod";
import { SLUG_PATTERN } from "../../db/json.js";
import { ICON_KEYS } from "../content/content.model.js";
import { PRICE_TYPES } from "../pricing/pricing.model.js";
import { PROJECT_CATEGORIES, PROJECT_STATUSES, PROJECT_VISIBILITIES } from "../projects/project.model.js";

// Ce que l'admin peut modifier, champ par champ. Schémas stricts : un champ inconnu est refusé.
// Une chaîne vide efface un champ facultatif (valeur `null` → `$unset` côté route).

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .optional();
const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value === "" || z.url({ protocol: /^https?$/ }).safeParse(value).success, "Adresse web invalide (http ou https).")
  .transform((value) => value || null)
  .optional();
const list = (max: number, itemMax = 200) => z.array(z.string().trim().min(1).max(itemMax)).max(max);

export const objectId = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, "Identifiant invalide.") });

export const pageQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

// Image d'un projet : fichier UploadThing (https) ou image livrée avec le site (/images/…).
const media = z
  .object({
    url: z
      .string()
      .trim()
      .max(500)
      .refine((value) => /^\/images\/[\w./-]+$/.test(value) || z.url({ protocol: /^https$/ }).safeParse(value).success, "Adresse d'image invalide."),
    alt: z.string().trim().min(1, "Décris l'image en quelques mots.").max(200),
    width: z.number().int().min(1).max(10_000).optional(),
    height: z.number().int().min(1).max(10_000).optional(),
    fileKey: z.string().trim().max(200).optional(),
  })
  .strict();

const projectFields = {
  title: text(120),
  kicker: optionalText(80),
  shortDescription: text(280),
  description: optionalText(4000),
  category: z.enum(PROJECT_CATEGORIES),
  status: z.enum(PROJECT_STATUSES),
  visibility: z.enum(PROJECT_VISIBILITIES),
  technologies: list(30, 60),
  features: list(30),
  liveUrl: optionalUrl,
  repositoryUrl: optionalUrl,
  demoVideo: optionalUrl,
  licenseAvailable: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.number().int().min(0).max(10_000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  coverImage: media.nullable(),
  gallery: z.array(media).max(12),
};

export const projectUpdateSchema = z.object(projectFields).partial().strict();
export const projectCreateSchema = z
  .object({
    ...projectFields,
    slug: z.string().trim().toLowerCase().max(100).regex(SLUG_PATTERN, "Lettres minuscules, chiffres et tirets."),
    visibility: z.enum(PROJECT_VISIBILITIES).default("private"),
  })
  .partial({ kicker: true, description: true, technologies: true, features: true, liveUrl: true, repositoryUrl: true, demoVideo: true, licenseAvailable: true, isFeatured: true, sortOrder: true, seoTitle: true, seoDescription: true, coverImage: true, gallery: true })
  .strict();

export const pricingUpdateSchema = z
  .object({
    name: text(80),
    kicker: optionalText(40),
    description: text(400),
    priceType: z.enum(PRICE_TYPES),
    // Montants ×100 (centimes), comme en base : jusqu'à 100 millions de FCFA.
    priceMin: z.number().int().min(0).max(10_000_000_000).nullable(),
    priceMax: z.number().int().min(0).max(10_000_000_000).nullable(),
    features: list(20),
    deliveryEstimate: optionalText(80),
    isPublished: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()
  .strict();

export const serviceUpdateSchema = z
  .object({
    name: text(80),
    summary: text(400),
    deliverables: list(12),
    proofs: z.array(z.string().regex(SLUG_PATTERN)).max(6),
    isPublished: z.boolean(),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()
  .strict();

export const settingsUpdateSchema = z
  .object({
    role: optionalText(80),
    tagline: optionalText(280),
    location: optionalText(80),
    email: z.union([z.literal(""), z.email().max(120)]).transform((value) => value || null).optional(),
    whatsappNumber: z
      .string()
      .trim()
      .transform((value) => value.replace(/\D/g, ""))
      .refine((value) => value === "" || /^\d{8,15}$/.test(value), "Numéro international, 8 à 15 chiffres (indicatif inclus).")
      .transform((value) => value || null)
      .optional(),
    cvUrl: optionalUrl,
    socials: z.array(z.object({ label: text(40), url: z.url({ protocol: /^https?$/ }).max(300) }).strict()).max(10),
    availability: z.object({ isAvailable: z.boolean(), label: z.string().trim().max(120).optional() }).strict(),
  })
  .partial()
  .strict();

const icon = z.enum(ICON_KEYS).optional();
const titleText = z.object({ title: text(60), text: text(300) }).strict();

export const contentUpdateSchema = z
  .object({
    method: z.array(titleText).max(10),
    journey: z
      .array(
        z
          .object({
            kind: z.enum(["venture", "work", "school"]),
            period: text(40),
            title: text(120),
            place: text(120),
            text: text(500),
            points: list(8, 300).optional(),
          })
          .strict(),
      )
      .max(20),
    skillGroups: z.array(z.object({ title: text(60), skills: list(20, 60) }).strict()).max(8),
    languages: z.array(z.object({ name: text(40), level: text(40) }).strict()).max(10),
    principles: z.array(z.object({ icon, title: text(80), text: text(300) }).strict()).max(8),
    values: z.array(z.object({ icon, label: text(60) }).strict()).max(8),
    afterDelivery: z.array(titleText).max(8),
    places: z.array(z.object({ label: text(80), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).strict()).max(20),
    licenceVsCustom: z.array(z.object({ criterion: text(60), licence: text(120), custom: text(120) }).strict()).max(10),
    creator: z
      .object({
        platform: z.literal("tiktok").default("tiktok"),
        handle: text(60),
        profileUrl: z.url({ protocol: /^https$/ }).max(300),
        bio: z.string().trim().max(300).optional(),
        recordedAt: text(40),
        stats: z.array(z.object({ label: text(40), value: text(20) }).strict()).max(6),
        videos: z
          .array(
            z
              .object({
                url: z.url({ protocol: /^https$/ }).max(300).refine((value) => /^https:\/\/(www\.)?tiktok\.com\//.test(value), "Lien TikTok attendu."),
                caption: text(200),
                views: z.string().trim().max(20).optional(),
                // Miniature hébergée avec le site (/images/…) ou en https (UploadThing).
                cover: z
                  .string()
                  .trim()
                  .max(500)
                  .refine((value) => /^\/images\/[\w./-]+$/.test(value) || z.url({ protocol: /^https$/ }).safeParse(value).success, "Adresse d'image invalide.")
                  .optional(),
              })
              .strict(),
          )
          .max(16),
      })
      .strict(),
  })
  .partial()
  .strict();

/** Sépare les champs à définir de ceux à effacer (valeur null). */
export function toUpdate(input: Record<string, unknown>) {
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value === null) $unset[key] = "";
    else $set[key] = value;
  }
  return { ...(Object.keys($set).length ? { $set } : {}), ...(Object.keys($unset).length ? { $unset } : {}) };
}
