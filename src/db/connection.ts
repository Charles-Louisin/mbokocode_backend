import mongoose from "mongoose";
import { AppError } from "../utils/errors.js";

export async function connectDatabase(uri: string, dbName: string): Promise<void> {
  mongoose.set("strictQuery", true);
  // Neutralise les opérateurs ($gt, $ne…) injectés dans les filtres de requête.
  mongoose.set("sanitizeFilter", true);
  // Sans connexion, une requête échoue tout de suite au lieu d'attendre en file.
  mongoose.set("bufferCommands", false);
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 8000 });
}

export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}

export function assertDatabaseReady(): void {
  if (!isDatabaseReady()) {
    throw new AppError(503, "SERVICE_UNAVAILABLE", "Service momentanément indisponible. Réessaie dans un instant.");
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
