import { z } from "zod";
import { BUDGETS, DEADLINES, FEATURES, keysOf, SERVICE_TYPES } from "./lead.options.js";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || undefined)
    .optional();

/** Numéro WhatsApp saisi librement : on ne garde que les chiffres (indicatif inclus). */
const whatsapp = z
  .string()
  .trim()
  .max(30)
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => digits === "" || (digits.length >= 8 && digits.length <= 15), "Numéro WhatsApp invalide (indicatif inclus).")
  .transform((digits) => digits || undefined)
  .optional();

const website = z
  .string()
  .trim()
  .max(300)
  .transform((value) => (value && !/^https?:\/\//i.test(value) ? `https://${value}` : value))
  .refine((value) => value === "" || z.url({ protocol: /^https?$/ }).safeParse(value).success, "Adresse de site invalide.")
  .transform((value) => value || undefined)
  .optional();

export const leadInputSchema = z
  .object({
    submissionId: z.uuid(),
    serviceType: z.enum(keysOf(SERVICE_TYPES)),
    goal: z.string().trim().min(20, "Décris ton projet en quelques phrases (20 caractères minimum).").max(3000),
    features: z.array(z.enum(keysOf(FEATURES))).max(10).default([]),
    constraints: optionalText(1500),
    budget: z.enum(keysOf(BUDGETS)).optional(),
    currency: z.enum(["EUR", "XAF"]).default("EUR"),
    deadline: z.enum(keysOf(DEADLINES)).optional(),
    name: z.string().trim().min(2, "Indique ton nom.").max(120),
    email: z.string().trim().max(200).pipe(z.email("Adresse e-mail invalide.")),
    whatsapp,
    company: optionalText(120),
    website,
    consent: z.literal(true, "Ton accord est nécessaire pour que je puisse te répondre."),
    sourcePage: optionalText(200),
    utm: z
      .object({ source: optionalText(100), medium: optionalText(100), campaign: optionalText(100) })
      .strict()
      .optional(),
    // Champ piège invisible : un humain le laisse vide.
    hp: z.string().max(200).optional(),
  })
  .strict();

export type LeadInput = z.output<typeof leadInputSchema>;
