import type { Logger } from "pino";
import { createRouteHandler, createUploadthing, type FileRouter } from "uploadthing/express";
import { UploadThingError, UTApi } from "uploadthing/server";
import type { AppConfig } from "../../config/env.js";
import type { SessionGuards } from "../auth/session.js";

export const UPLOADS_PATH = "/api/uploadthing";

/** Images de projet : administrateur uniquement, formats image, 4 Mo maximum, 8 fichiers par envoi. */
export function createUploadRouter(guards: SessionGuards) {
  const f = createUploadthing();
  return {
    projectImage: f({ image: { maxFileSize: "4MB", maxFileCount: 8 } })
      // L'identité et le rôle sont revérifiés au moment même de l'envoi.
      .middleware(async ({ req }) => {
        const user = await guards.loadUser(req).catch(() => null);
        if (!user) throw new UploadThingError({ code: "FORBIDDEN", message: "Connecte-toi pour envoyer une image." });
        if (!user.isAdmin) throw new UploadThingError({ code: "FORBIDDEN", message: "Envoi réservé à l'administrateur." });
        return { userId: user.id };
      })
      // Le navigateur reçoit l'adresse publique et la clé (pour supprimer le fichier plus tard).
      .onUploadComplete(({ file }) => ({ url: file.ufsUrl, key: file.key, name: file.name })),
  } satisfies FileRouter;
}

export function createUploadsHandler(config: AppConfig, guards: SessionGuards) {
  return createRouteHandler({
    router: createUploadRouter(guards),
    config: {
      // Le navigateur passe par le site, qui relaie /api/uploadthing vers l'API.
      callbackUrl: `${config.BETTER_AUTH_URL ?? config.FRONTEND_URL}${UPLOADS_PATH}`,
      logLevel: config.NODE_ENV === "production" ? "Error" : "Warning",
    },
  });
}

/** Suppression des fichiers devenus orphelins (projet supprimé, image retirée). Sans effet si rien à supprimer. */
export async function deleteUploadedFiles(keys: string[], logger: Logger) {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0 || !process.env.UPLOADTHING_TOKEN) return;
  try {
    await new UTApi().deleteFiles(unique);
  } catch (err) {
    logger.warn({ count: unique.length, reason: (err as Error).message }, "suppression UploadThing impossible");
  }
}
