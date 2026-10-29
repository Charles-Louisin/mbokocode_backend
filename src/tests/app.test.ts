import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../logger.js";

// Aucune base n'est connectée : les routes de données doivent répondre 503 proprement,
// après avoir validé leurs paramètres.
const config = loadConfig({ NODE_ENV: "test", ALLOWED_ORIGINS: "http://localhost:3000" });
const app = createApp(config, createLogger("silent"));

function expectErrorShape(body: unknown, code: string) {
  expect(body).toMatchObject({ error: { code, message: expect.any(String) }, requestId: expect.any(String) });
  expect(JSON.stringify(body)).not.toMatch(/stack|mongodb(\+srv)?:\/\//i);
}

describe("santé", () => {
  it("GET /health répond ok sans détail de configuration", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers["x-request-id"]).toBeTruthy();
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("GET /ready répond 503 sans base de données", async () => {
    const res = await request(app).get("/api/v1/ready");
    expect(res.status).toBe(503);
    expectErrorShape(res.body, "SERVICE_UNAVAILABLE");
  });
});

describe("format d'erreur", () => {
  it("route inconnue → 404 uniforme", async () => {
    const res = await request(app).get("/api/v1/nope");
    expect(res.status).toBe(404);
    expectErrorShape(res.body, "NOT_FOUND");
  });

  it("JSON invalide → 400", async () => {
    const res = await request(app).post("/api/v1/projects").set("Content-Type", "application/json").send("{oups");
    expect(res.status).toBe(400);
    expectErrorShape(res.body, "BAD_REQUEST");
  });

  it("corps trop volumineux → 413", async () => {
    const res = await request(app)
      .post("/api/v1/projects")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ blob: "x".repeat(200_000) }));
    expect(res.status).toBe(413);
    expectErrorShape(res.body, "PAYLOAD_TOO_LARGE");
  });
});

describe("projets publics", () => {
  it("rejette une catégorie inconnue avec les champs en erreur", async () => {
    const res = await request(app).get("/api/v1/projects?category=crypto");
    expect(res.status).toBe(400);
    expectErrorShape(res.body, "VALIDATION_ERROR");
    expect(res.body.error.fieldErrors).toHaveProperty("category");
  });

  it("rejette un opérateur MongoDB injecté dans la query string", async () => {
    const res = await request(app).get("/api/v1/projects?category[$ne]=web");
    expect(res.status).toBe(400);
  });

  it("rejette un slug malformé", async () => {
    const res = await request(app).get("/api/v1/projects/Mauvais%20Slug");
    expect(res.status).toBe(400);
  });

  it("paramètres valides mais base absente → 503", async () => {
    const res = await request(app).get("/api/v1/projects?category=web&featured=true");
    expect(res.status).toBe(503);
  });
});

describe("CORS", () => {
  it("autorise l'origine configurée avec credentials", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("n'envoie aucun en-tête CORS à une origine inconnue", async () => {
    const res = await request(app).get("/api/v1/health").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
