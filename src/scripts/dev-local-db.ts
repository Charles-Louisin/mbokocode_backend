// Développement sans Atlas : démarre une base MongoDB éphémère en mémoire, importe le contenu
// initial, puis lance l'API. Les données disparaissent à l'arrêt. Jamais utilisé en production.
import { MongoMemoryServer } from "mongodb-memory-server";
import { applyUploadThingTokenAlias } from "../config/uploadthing.js";

const uploadThingReady = applyUploadThingTokenAlias(process.env);
// Premier lancement lent sous Windows (analyse antivirus du binaire) : délai large.
const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
process.env.MONGODB_URI = mongo.getUri();
process.env.NODE_ENV = "development";

const { startServer } = await import("../server.js");
const { seedDatabase } = await import("./seed-runner.js");

await startServer({ uploadThingReady });
console.log(`Base locale prête : ${await seedDatabase()}.`);

const stop = () => void mongo.stop();
process.once("exit", stop);
