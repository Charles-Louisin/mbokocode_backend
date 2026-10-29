// État de la base configurée dans .env : nombre de documents par collection, en lecture seule.
// Usage : npm run db:status
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import mongoose from "mongoose";

const config = loadConfig();
if (!config.MONGODB_URI) {
  console.error("MONGODB_URI manquant dans backend/.env");
  process.exit(1);
}

try {
  await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
  const db = mongoose.connection.db!;
  const collections = await db.listCollections().toArray();
  console.log(`Base « ${config.MONGODB_DB_NAME} » : ${collections.length} collection(s)`);
  for (const { name } of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  ${name.padEnd(22)} ${await db.collection(name).countDocuments()}`);
  }
} catch (err) {
  // Nom et message seulement : jamais l'URI de connexion.
  const { name, message } = err as Error;
  console.error(`Connexion impossible (${name}) : ${message.replace(/mongodb(\+srv)?:\/\/\S+/g, "<uri>")}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
