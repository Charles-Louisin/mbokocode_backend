// Import idempotent du contenu initial : peut être relancé sans créer de doublon ni écraser
// une modification faite depuis le tableau de bord. Suppose une connexion Mongoose ouverte.
import { type Model, trusted } from "mongoose";
import { SiteContent } from "../modules/content/content.model.js";
import { PricingPackage } from "../modules/pricing/pricing.model.js";
import { Service } from "../modules/pricing/service.model.js";
import { Project } from "../modules/projects/project.model.js";
import { SiteSettings } from "../modules/settings/settings.model.js";
import { seedContent, seedPricing, seedProjects, seedServices, seedSettings } from "./seed-data.js";

export async function seedDatabase(): Promise<string> {
  await Promise.all([
    Project.syncIndexes(),
    PricingPackage.syncIndexes(),
    Service.syncIndexes(),
    SiteSettings.syncIndexes(),
    SiteContent.syncIndexes(),
  ]);

  const now = new Date();

  // Le tableau de bord fait foi : un document existant n'est jamais écrasé. On crée ce qui manque,
  // et on ne pose sur un document existant que les champs encore absents (ex. un lien de démo ajouté au seed).
  const fillMissing = async (model: Model<any>, filter: Record<string, unknown>, fields: Record<string, unknown>, onInsert: Record<string, unknown> = {}) => {
    await model.updateOne(filter, { $setOnInsert: { ...fields, ...onInsert } }, { upsert: true, runValidators: true });
    for (const [field, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      await model.updateOne({ ...filter, [field]: trusted({ $exists: false }) }, { $set: { [field]: value } }, { runValidators: true });
    }
  };

  for (const project of seedProjects) await fillMissing(Project, { slug: project.slug }, project, { publishedAt: now });
  for (const offer of seedPricing) await fillMissing(PricingPackage, { slug: offer.slug }, { ...offer, isPublished: true });
  for (const service of seedServices) await fillMissing(Service, { slug: service.slug }, { ...service, isPublished: true });
  await fillMissing(SiteSettings, { key: "site" }, seedSettings);
  await fillMissing(SiteContent, { key: "site" }, seedContent);

  return `${seedProjects.length} projets, ${seedPricing.length} offres, ${seedServices.length} savoir-faire, réglages et contenu du site`;
}
