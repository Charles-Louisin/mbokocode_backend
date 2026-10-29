// Met à jour le numéro WhatsApp des réglages du site dans la base de backend/.env.
// Usage : npm run settings:whatsapp -- 2376XXXXXXXX
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { SiteSettings } from "../modules/settings/settings.model.js";

const number = (process.argv[2] ?? "").replace(/\D/g, "");
if (!/^\d{8,15}$/.test(number)) {
  console.error("Numéro attendu au format international, chiffres uniquement (ex. 2376XXXXXXXX).");
  process.exit(1);
}
const config = loadConfig();
if (!config.MONGODB_URI) {
  console.error("MONGODB_URI manquant dans backend/.env");
  process.exit(1);
}
await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
const result = await SiteSettings.updateOne({ key: "site" }, { $set: { whatsappNumber: number } }, { runValidators: true });
console.log(result.matchedCount ? `Numéro WhatsApp enregistré (${number}).` : "Réglages introuvables : lance d'abord npm run seed.");
await disconnectDatabase();
