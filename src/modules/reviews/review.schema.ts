import { z } from "zod";
import { SLUG_PATTERN } from "../../db/json.js";
import { RELATIONSHIP_TYPES } from "./review.model.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

// Champs que l'auteur peut écrire. `status`, `isVerifiedClient`, `userId`… sont absents :
// le schéma strict les refuse au lieu de les ignorer.
const reviewFields = {
  rating: z.number().int().min(1, "Note de 1 à 5.").max(5, "Note de 1 à 5."),
  title: optionalText(80),
  content: z.string().trim().min(30, "Écris au moins 30 caractères.").max(1200, "1 200 caractères au maximum."),
  authorName: z.string().trim().min(2, "Indique le nom à afficher.").max(60),
  authorRole: optionalText(80),
  relationshipType: z.enum(RELATIONSHIP_TYPES).optional(),
  projectSlug: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .pipe(z.string().regex(SLUG_PATTERN).optional())
    .optional(),
};

export const reviewCreateSchema = z
  .object({ ...reviewFields, consent: z.literal(true, "Ton accord est nécessaire pour publier ton avis.") })
  .strict();

export const reviewUpdateSchema = z
  .object(reviewFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Aucune modification envoyée.");

export const reviewListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100).default(1),
    limit: z.coerce.number().int().min(1).max(24).default(12),
  })
  .strict();

export const objectIdParamSchema = z.object({ id: z.string().regex(/^[a-f0-9]{24}$/, "Identifiant invalide.") });
