import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { seedDatabase } from "./seed-runner.js";

const config = loadConfig();
if (!config.MONGODB_URI) {
  console.error("MONGODB_URI manquant dans backend/.env");
  process.exit(1);
}

await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
console.log(`Import terminé : ${await seedDatabase()}.`);
await disconnectDatabase();
