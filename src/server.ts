import { createApp } from "./app.js";
import { loadConfig } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./db/connection.js";
import { createLogger } from "./logger.js";

type StartOptions = { uploadThingReady: boolean };

export async function startServer({ uploadThingReady }: StartOptions) {
  const config = loadConfig();
  const logger = createLogger(config.LOG_LEVEL, config.NODE_ENV === "development");

  logger.info(`UploadThing ${uploadThingReady ? "configuré" : "non configuré"}`);

  if (config.MONGODB_URI) {
    try {
      await connectDatabase(config.MONGODB_URI, config.MONGODB_DB_NAME);
      logger.info("MongoDB connecté");
    } catch (err) {
      // Nom et message seulement : pas d'objet brut susceptible de contenir l'URI.
      const { name, message } = err as Error;
      logger.error({ name, message }, "Connexion MongoDB impossible");
      if (config.NODE_ENV === "production") process.exit(1);
    }
  } else {
    logger.warn("MONGODB_URI absent : les routes de données répondront 503");
  }

  const app = createApp(config, logger);
  const server = app.listen(config.PORT, () => {
    logger.info(`API disponible sur http://localhost:${config.PORT}/api/v1`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} reçu, arrêt en cours`);
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
