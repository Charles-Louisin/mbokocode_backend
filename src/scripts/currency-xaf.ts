// Passe les prix du site d'euros en francs CFA (XAF), à la parité fixe 1 € = 655,957 FCFA, arrondis
// aux 5 000 FCFA, et règle la devise du site sur XAF. Sans --apply : simple aperçu, rien n'est écrit.
// Usage : npm run currency:xaf            (aperçu)
//         npm run currency:xaf -- --apply (écrit dans la base de backend/.env)
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { PricingPackage } from "../modules/pricing/pricing.model.js";
import { XAF_PER_EUR } from "../modules/rates/rates.routes.js";
import { SiteSettings } from "../modules/settings/settings.model.js";

const apply = process.argv.includes("--apply");
const config = loadConfig();
if (!config.MONGODB_URI) {
  console.error("MONGODB_URI manquant dans backend/.env");
  process.exit(1);
}

// Les montants restent stockés ×100, comme en centimes : 100 000 FCFA → 10 000 000.
const toXaf = (eurMinor: number | null | undefined) => (eurMinor == null ? eurMinor : Math.round((eurMinor / 100) * XAF_PER_EUR / 5000) * 5000 * 100);
const show = (minor: number | null | undefined, currency: string) => (minor == null ? "—" : `${new Intl.NumberFormat("fr-FR").format(minor / 100)} ${currency}`);

try {
  await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
  const offers = await PricingPackage.find({ currency: "EUR" });
  console.log(`${offers.length} offre(s) en euros${apply ? "" : " (aperçu, rien n'est écrit)"} :`);
  for (const offer of offers) {
    const min = toXaf(offer.priceMin);
    const max = toXaf(offer.priceMax);
    console.log(`  ${offer.name.padEnd(30)} ${show(offer.priceMin, "€")} → ${show(min, "FCFA")}${offer.priceMax != null ? ` / ${show(offer.priceMax, "€")} → ${show(max, "FCFA")}` : ""}`);
    if (apply) {
      offer.set({ currency: "XAF", priceMin: min, priceMax: max });
      await offer.save();
    }
  }
  const settings = await SiteSettings.findOne({ key: "site" });
  console.log(`Devise du site : ${settings?.currency ?? "?"} → XAF`);
  if (apply && settings) {
    settings.set({ currency: "XAF" });
    await settings.save();
  }
  console.log(apply ? "Terminé." : "Relance avec --apply pour écrire ces changements.");
} catch (err) {
  // Nom et message seulement : jamais l'URI de connexion.
  const { name, message } = err as Error;
  console.error(`Échec (${name}) : ${message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>")}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
