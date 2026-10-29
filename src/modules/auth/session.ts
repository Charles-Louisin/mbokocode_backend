import type { NextFunction, Request, RequestHandler, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { adminEmails, type Auth } from "./auth.js";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  isAdmin: boolean;
};

const unavailable = () => new AppError(503, "SERVICE_UNAVAILABLE", "La connexion est momentanément indisponible.");

/**
 * Lecture de la session Better Auth à chaque requête protégée.
 * Le statut admin est recalculé côté serveur : email vérifié ET présent dans ADMIN_EMAILS.
 */
export function createSessionGuards(getAuth: () => Auth | null, config: Pick<AppConfig, "ADMIN_EMAILS">) {
  const admins = adminEmails(config);

  async function loadUser(req: Request): Promise<SessionUser | null> {
    const auth = getAuth();
    if (!auth) throw unavailable();
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) return null;
    const { user } = session;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
      isAdmin: user.emailVerified && admins.has(user.email.toLowerCase()),
    };
  }

  const requireUser: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadUser(req);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Connecte-toi pour continuer.");
    res.locals.user = user;
    next();
  };

  const requireAdmin: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const user = await loadUser(req);
    if (!user) throw new AppError(401, "UNAUTHENTICATED", "Connecte-toi pour continuer.");
    if (!user.isAdmin) throw new AppError(403, "FORBIDDEN", "Accès réservé à l'administrateur.");
    res.locals.user = user;
    next();
  };

  return { requireUser, requireAdmin, loadUser };
}

export type SessionGuards = ReturnType<typeof createSessionGuards>;

/** Utilisateur posé par requireUser / requireAdmin. */
export function currentUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Connecte-toi pour continuer.");
  return user;
}
