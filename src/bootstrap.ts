// Point d'entrée : prépare l'environnement avant de charger le reste de l'application.
import { applyUploadThingTokenAlias } from "./config/uploadthing.js";

const uploadThingReady = applyUploadThingTokenAlias(process.env);

const { startServer } = await import("./server.js");
await startServer({ uploadThingReady });
