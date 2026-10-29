import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { createLogger } from "../logger.js";
import { AdminActivity } from "../modules/admin/activity.model.js";
import { Project } from "../modules/projects/project.model.js";
import { seedDatabase } from "../scripts/seed-runner.js";
import type { EmailMessage, Mailer } from "../services/email/mailer.js";

// Faux service d'email : il garde les liens de connexion au lieu de les envoyer.
const sent: EmailMessage[] = [];
const mailer: Mailer = {
  enabled: true,
  adminEmail: "charles@example.com",
  async send(message) {
    sent.push(message);
    return { status: "sent", attempts: 1 };
  },
};

const ORIGIN = "http://localhost:3000";
let mongo: MongoMemoryServer;
const config = loadConfig({
  NODE_ENV: "test",
  BETTER_AUTH_SECRET: "test-secret-for-better-auth-0123456789abcdef",
  ADMIN_EMAILS: "charles@example.com",
  ALLOWED_ORIGINS: ORIGIN,
  FRONTEND_URL: ORIGIN,
});
const app = createApp(config, createLogger("silent"), { mailer, reviewsWriteLimit: 1000 });

async function signIn(email: string): Promise<string> {
  sent.length = 0;
  await request(app).post("/api/auth/sign-in/magic-link").set("Origin", ORIGIN).send({ email }).expect(200);
  const url = new URL(sent.find((message) => message.to === email)!.text.match(/https?:\/\/\S+/)![0]);
  const response = await request(app).get(`${url.pathname}${url.search}`);
  return ([] as string[])
    .concat(response.headers["set-cookie"] ?? [])
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

let admin: string;
let user: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
  await connectDatabase(mongo.getUri(), "test-admin");
  await seedDatabase();
  admin = await signIn("charles@example.com");
  user = await signIn("awa@example.com");
}, 120_000);

afterAll(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});

const ROUTES = ["/overview", "/projects", "/pricing", "/services", "/settings", "/content", "/users", "/activity"];

describe("accès au tableau de bord", () => {
  it("401 sans session, 403 pour un utilisateur, 200 pour l'admin", async () => {
    for (const route of ROUTES) {
      await request(app).get(`/api/v1/admin${route}`).expect(401);
      await request(app).get(`/api/v1/admin${route}`).set("Cookie", user).expect(403);
      await request(app).get(`/api/v1/admin${route}`).set("Cookie", admin).expect(200);
    }
  });

  it("un utilisateur ne peut rien modifier", async () => {
    const project = await Project.findOne({ slug: "koumale" });
    await request(app).patch(`/api/v1/admin/projects/${project!.id}`).set("Cookie", user).send({ title: "Piraté" }).expect(403);
    await request(app).patch("/api/v1/admin/settings").set("Cookie", user).send({ whatsappNumber: "237600000000" }).expect(403);
    expect((await Project.findById(project!.id))?.title).toBe("KOUMALE");
  });
});

describe("modifications admin", () => {
  it("vue d'ensemble : compteurs réels", async () => {
    const res = await request(app).get("/api/v1/admin/overview").set("Cookie", admin).expect(200);
    expect(res.body.data.projects.total).toBe(7);
    expect(res.body.data.users).toBe(2);
    expect(res.body.data.reviews).toEqual({ pending: 0, approved: 0, rejected: 0, hidden: 0 });
  });

  it("modifie un projet, efface un lien avec une chaîne vide, journalise", async () => {
    const project = await Project.findOne({ slug: "monde-delice" });
    const res = await request(app)
      .patch(`/api/v1/admin/projects/${project!.id}`)
      .set("Cookie", admin)
      .send({ isFeatured: true, liveUrl: "" })
      .expect(200);
    expect(res.body.data.isFeatured).toBe(true);
    expect(res.body.data).not.toHaveProperty("liveUrl");
    expect(await AdminActivity.countDocuments({ action: "project.update", targetId: project!.id })).toBe(1);
  });

  it("refuse un champ non modifiable ou une URL invalide", async () => {
    const project = await Project.findOne({ slug: "koumale" });
    await request(app).patch(`/api/v1/admin/projects/${project!.id}`).set("Cookie", admin).send({ slug: "autre" }).expect(400);
    const bad = await request(app).patch(`/api/v1/admin/projects/${project!.id}`).set("Cookie", admin).send({ liveUrl: "javascript:alert(1)" }).expect(400);
    expect(bad.body.error.fieldErrors).toHaveProperty("liveUrl");
  });

  it("crée un projet privé par défaut ; un slug en double donne 409", async () => {
    const body = { title: "Nouveau", slug: "nouveau-projet", shortDescription: "Un projet de test.", category: "web", status: "prototype" };
    const res = await request(app).post("/api/v1/admin/projects").set("Cookie", admin).send(body).expect(201);
    expect(res.body.data.visibility).toBe("private");
    await request(app).post("/api/v1/admin/projects").set("Cookie", admin).send(body).expect(409);
    const publicList = await request(app).get("/api/v1/projects?limit=50").expect(200);
    expect(publicList.body.data.map((p: { slug: string }) => p.slug)).not.toContain("nouveau-projet");
  });

  it("images : couverture et galerie acceptées, adresse douteuse refusée", async () => {
    const project = await Project.findOne({ slug: "koumale" });
    const image = { url: "https://abc123.ufs.sh/f/key-1", alt: "Accueil de KOUMALE", width: 1200, height: 800, fileKey: "key-1" };
    const res = await request(app).patch(`/api/v1/admin/projects/${project!.id}`).set("Cookie", admin).send({ gallery: [image] }).expect(200);
    expect(res.body.data.gallery[0]).toMatchObject({ url: image.url, fileKey: "key-1" });
    // La clé de fichier reste interne : la page publique ne l'expose pas.
    const publicProject = await request(app).get("/api/v1/projects/koumale").expect(200);
    expect(publicProject.body.data.gallery[0]).not.toHaveProperty("fileKey");
    for (const url of ["javascript:alert(1)", "http://exemple.com/a.png", "/etc/passwd"]) {
      await request(app).patch(`/api/v1/admin/projects/${project!.id}`).set("Cookie", admin).send({ gallery: [{ ...image, url }] }).expect(400);
    }
  });

  it("suppression : réservée à l'admin, définitive et journalisée", async () => {
    const created = await request(app)
      .post("/api/v1/admin/projects")
      .set("Cookie", admin)
      .send({ title: "À supprimer", slug: "a-supprimer", shortDescription: "Projet de test.", category: "web", status: "prototype" })
      .expect(201);
    const id = created.body.data.id as string;
    await request(app).delete(`/api/v1/admin/projects/${id}`).set("Cookie", user).expect(403);
    await request(app).delete(`/api/v1/admin/projects/${id}`).set("Cookie", admin).expect(204);
    expect(await Project.findById(id)).toBeNull();
    expect(await AdminActivity.countDocuments({ action: "project.delete", targetId: id })).toBe(1);
    await request(app).delete(`/api/v1/admin/projects/${id}`).set("Cookie", admin).expect(404);
  });

  it("offres : les règles de prix du modèle s'appliquent", async () => {
    const offers = await request(app).get("/api/v1/admin/pricing").set("Cookie", admin).expect(200);
    const landing = offers.body.data.find((offer: { slug: string }) => offer.slug === "landing-page");
    const bad = await request(app)
      .patch(`/api/v1/admin/pricing/${landing.id}`)
      .set("Cookie", admin)
      .send({ priceType: "range", priceMin: 50_000, priceMax: 10_000 })
      .expect(400);
    expect(bad.body.error.fieldErrors).toHaveProperty("priceMax");
    const ok = await request(app).patch(`/api/v1/admin/pricing/${landing.id}`).set("Cookie", admin).send({ priceMin: 60_000 }).expect(200);
    expect(ok.body.data.priceMin).toBe(60_000);
  });

  it("relancer l'import n'écrase pas une modification du tableau de bord", async () => {
    const project = await Project.findOne({ slug: "hevecam" });
    await request(app).patch(`/api/v1/admin/projects/${project!.id}`).set("Cookie", admin).send({ title: "HEVECAM (modifié)", liveUrl: "https://exemple.com" }).expect(200);
    await seedDatabase();
    const after = await Project.findById(project!.id);
    expect(after?.title).toBe("HEVECAM (modifié)");
    expect(after?.liveUrl).toBe("https://exemple.com");
  });

  it("réglages : numéro WhatsApp normalisé, invalide refusé", async () => {
    const res = await request(app).patch("/api/v1/admin/settings").set("Cookie", admin).send({ whatsappNumber: "+237 6 93 46 02 59" }).expect(200);
    expect(res.body.data.whatsappNumber).toBe("237693460259");
    await request(app).patch("/api/v1/admin/settings").set("Cookie", admin).send({ whatsappNumber: "12" }).expect(400);
    const publicSettings = await request(app).get("/api/v1/settings").expect(200);
    expect(publicSettings.body.data.whatsappNumber).toBe("237693460259");
  });

  it("contenu : remplace une section, valide sa forme", async () => {
    await request(app).patch("/api/v1/admin/content").set("Cookie", admin).send({ languages: [{ name: "Français" }] }).expect(400);
    await request(app)
      .patch("/api/v1/admin/content")
      .set("Cookie", admin)
      .send({ languages: [{ name: "Français", level: "Avancé" }, { name: "Anglais", level: "Intermédiaire" }] })
      .expect(200);
    const content = await request(app).get("/api/v1/content").expect(200);
    expect(content.body.data.languages[1].level).toBe("Intermédiaire");
  });

  it("comptes : rôle déduit d'ADMIN_EMAILS, jamais modifiable", async () => {
    const res = await request(app).get("/api/v1/admin/users").set("Cookie", admin).expect(200);
    const byEmail = Object.fromEntries(res.body.data.map((u: { email: string; isAdmin: boolean }) => [u.email, u.isAdmin]));
    expect(byEmail).toEqual({ "charles@example.com": true, "awa@example.com": false });
    await request(app).patch("/api/v1/admin/users").set("Cookie", admin).send({ isAdmin: true }).expect(404);
  });

  it("journal : les actions récentes sont listées", async () => {
    const res = await request(app).get("/api/v1/admin/activity").set("Cookie", admin).expect(200);
    expect(res.body.meta.total).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty("action");
  });
});
