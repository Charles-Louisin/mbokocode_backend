/**
 * Le propriétaire utilise UPLOADTHING8TOKEN ; le SDK UploadThing lit UPLOADTHING_TOKEN.
 * Ce mapping doit s'exécuter avant tout import du SDK (voir bootstrap.ts).
 * Retourne seulement l'état « configuré ou non », jamais la valeur.
 */
export function applyUploadThingTokenAlias(env: NodeJS.ProcessEnv = process.env): boolean {
  const custom = env.UPLOADTHING8TOKEN?.trim();
  if (custom) {
    env.UPLOADTHING_TOKEN = custom;
  }
  return Boolean(env.UPLOADTHING_TOKEN?.trim());
}
