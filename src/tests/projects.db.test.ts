import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { createLogger } from "../logger.js";
import { Project } from "../modules/projects/project.model.js";
import { seedDatabase } from "../scripts/seed-runner.js";

// Tests d'intégration sur une vraie base MongoDB en mémoire.
let mongo: MongoMemoryServer;
const app = createApp(loadConfig({ NODE_ENV: "test" }), createLogger("silent"));

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
  await connectDatabase(mongo.getUri(), "test");
  await seedDatabase();
  const base = { shortDescription: "x", category: "web" as const, status: "prototype" as const, publishedAt: new Date() };
  await Project.create([
    { ...base, title: "Privé", slug: "prive", visibility: "private" as const },
    { ...base, title: "Non listé", slug: "non-liste", visibility: "unlisted" as const },
    { ...base, title: "Futur", slug: "futur", visibility: "public" as const, publishedAt: new Date(Date.now() + 86_400_000) },
  ]);
}, 120_000);

afterAll(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});

describe("contenu du site (base réelle)", () => {
  it("expose les savoir-faire publiés, dans l'ordre", async () => {
    const res = await request(app).get("/api/v1/services").expect(200);
    expect(res.body.data.map((service: { slug: string }) => service.slug)).toEqual(["plateformes", "applications", "sites", "evolution"]);
    expect(res.body.data[0].proofs).toEqual(["hevecam", "koumale"]);
  });

  it("expose le contenu éditorial importé", async () => {
    const res = await request(app).get("/api/v1/content").expect(200);
    expect(res.body.data.method).toHaveLength(6);
    expect(res.body.data.journey[0]).toMatchObject({ kind: "venture", period: "Aujourd'hui" });
    expect(res.body.data.skillGroups).toHaveLength(3);
    expect(res.body.data).not.toHaveProperty("key");
  });

  it("relancer l'import ne crée pas de doublon", async () => {
    await seedDatabase();
    const res = await request(app).get("/api/v1/services").expect(200);
    expect(res.body.data).toHaveLength(4);
  });
});

describe("projets publics (base réelle)", () => {
  it("liste uniquement les projets publics déjà publiés, dans l'ordre éditorial", async () => {
    const res = await request(app).get("/api/v1/projects?limit=50");
    expect(res.status).toBe(200);
    const slugs = res.body.data.map((project: { slug: string }) => project.slug);
    expect(slugs[0]).toBe("koumale");
    expect(slugs).not.toContain("prive");
    expect(slugs).not.toContain("non-liste");
    expect(slugs).not.toContain("futur");
    expect(res.body.meta.total).toBe(slugs.length);
    expect(res.body.data[0]).toHaveProperty("id");
    expect(res.body.data[0]).not.toHaveProperty("_id");
  });

  it("filtre par catégorie et projets mis en avant", async () => {
    const res = await request(app).get("/api/v1/projects?category=platform&featured=true");
    expect(res.status).toBe(200);
    expect(res.body.data.every((project: { category: string }) => project.category === "platform")).toBe(true);
  });

  it("ouvre un projet non listé par son lien direct, jamais un projet privé", async () => {
    expect((await request(app).get("/api/v1/projects/non-liste")).status).toBe(200);
    expect((await request(app).get("/api/v1/projects/prive")).status).toBe(404);
    expect((await request(app).get("/api/v1/projects/futur")).status).toBe(404);
  });

  it("le détail n'expose pas la visibilité ni la clé de fichier", async () => {
    const res = await request(app).get("/api/v1/projects/koumale");
    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty("visibility");
    expect(res.body.data.coverImage).not.toHaveProperty("fileKey");
  });

  it("offres et réglages publiés", async () => {
    const pricing = await request(app).get("/api/v1/pricing");
    expect(pricing.body.data.map((offer: { priceMin?: number }) => offer.priceMin).slice(0, 3)).toEqual([50000, 100000, 200000]);
    const settings = await request(app).get("/api/v1/settings");
    expect(settings.body.data.publicName).toBe("MBOKO CODE");
  });
});
