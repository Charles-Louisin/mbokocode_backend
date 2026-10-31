// Ajoute le compte TikTok entreprise (@mbokocode) au contenu du site dans la base de backend/.env,
// à partir de seed-data.ts. Ne touche à rien d'autre ; un compte déjà présent n'est remplacé
// qu'avec --force (sinon on le modifie depuis le tableau de bord).
// Usage : npm run content:tiktok-business [-- --force]
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { SiteContent } from "../modules/content/content.model.js";
import { seedContent } from "./seed-data.js";

const force = process.argv.includes("--force");
const config = loadConfig();
if (!config.MONGODB_URI) {
  console.error("MONGODB_URI manquant dans backend/.env");
  process.exit(1);
}

try {
  await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
  const filter = force ? { key: "site" } : { key: "site", businessCreator: { $exists: false } };
  const result = await SiteContent.updateOne(filter, { $set: { businessCreator: seedContent.businessCreator } }, { runValidators: true });
  const { handle, videos } = seedContent.businessCreator;
  console.log(
    result.modifiedCount
      ? `Compte @${handle} enregistré (${videos.length} vidéos).`
      : result.matchedCount || !force
        ? `Compte @${handle} déjà présent : rien n'a changé (--force pour le remplacer).`
        : "Contenu du site introuvable : lance d'abord npm run seed.",
  );
} catch (err) {
  // Nom et message seulement : jamais l'URI de connexion.
  const { name, message } = err as Error;
  console.error(`Échec (${name}) : ${message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>")}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
