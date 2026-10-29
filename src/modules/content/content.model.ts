import { type InferSchemaType, Schema, type SchemaDefinition, model } from "mongoose";
import { publicJson } from "../../db/json.js";

// Contenu éditorial du site (document unique, clé « site ») : méthode, parcours, compétences,
// langues, principes et engagements. Le site n'affiche que ce qui est enregistré ici.

const text = (max: number, required = true) => ({ type: String, trim: true, maxlength: max, required });
const sub = (fields: SchemaDefinition) => new Schema(fields, { _id: false });

/** Pictogrammes autorisés : le site associe chaque clé à une icône connue. */
export const ICON_KEYS = ["messages", "target", "shield", "code", "gauge", "handshake"] as const;

const siteContentSchema = new Schema(
  {
    key: { type: String, default: "site", unique: true, immutable: true },
    method: { type: [sub({ title: text(60), text: text(300) })], default: [] },
    journey: {
      type: [
        sub({
          kind: { type: String, enum: ["venture", "work", "school"], required: true },
          period: text(40),
          title: text(120),
          place: text(120),
          text: text(500),
          points: { type: [String], default: undefined },
        }),
      ],
      default: [],
    },
    skillGroups: { type: [sub({ title: text(60), skills: { type: [String], default: [] } })], default: [] },
    languages: { type: [sub({ name: text(40), level: text(40) })], default: [] },
    principles: { type: [sub({ icon: { type: String, enum: ICON_KEYS }, title: text(80), text: text(300) })], default: [] },
    values: { type: [sub({ icon: { type: String, enum: ICON_KEYS }, label: text(60) })], default: [] },
    afterDelivery: { type: [sub({ title: text(60), text: text(300) })], default: [] },
    // Lieux où tournent des projets livrés (carte de l'accueil).
    places: { type: [sub({ label: text(80), lat: { type: Number, min: -90, max: 90, required: true }, lng: { type: Number, min: -180, max: 180, required: true } })], default: [] },
    licenceVsCustom: { type: [sub({ criterion: text(60), licence: text(120), custom: text(120) })], default: [] },
    // Création de contenu (TikTok) : chiffres relevés à une date donnée, jamais estimés.
    creator: {
      type: sub({
        platform: { type: String, enum: ["tiktok"], default: "tiktok" },
        handle: text(60),
        profileUrl: text(300),
        bio: text(300, false),
        recordedAt: text(40),
        stats: { type: [sub({ label: text(40), value: text(20) })], default: [] },
        videos: {
          type: [sub({ url: text(300), caption: text(200), views: text(20, false), cover: text(500, false) })],
          default: [],
        },
      }),
      default: undefined,
    },
  },
  { timestamps: true, toJSON: publicJson },
);

export type SiteContentData = InferSchemaType<typeof siteContentSchema>;
export const SiteContent = model("SiteContent", siteContentSchema);
