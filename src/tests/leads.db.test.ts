import { randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { createLogger } from "../logger.js";
import { Lead } from "../modules/leads/lead.model.js";
import type { EmailMessage, Mailer } from "../services/email/mailer.js";

// Faux service d'email : il enregistre les envois au lieu d'appeler Resend.
const sent: EmailMessage[] = [];
const mailer: Mailer = {
  enabled: true,
  adminEmail: "charles@example.com",
  async send(message) {
    sent.push(message);
    return { status: "sent", attempts: 1 };
  },
};

let mongo: MongoMemoryServer;
const config = loadConfig({ NODE_ENV: "test" });
const app = createApp(config, createLogger("silent"), { mailer, leadsRateLimit: 1000 });

const validLead = () => ({
  submissionId: randomUUID(),
  serviceType: "ecommerce",
  goal: "Je veux vendre mes produits artisanaux en ligne avec paiement mobile.",
  features: ["paiement", "admin"],
  budget: "1000-2000",
  deadline: "1-3-mois",
  name: "Awa Ndiaye",
  email: "Awa@Example.com",
  whatsapp: "+237 6 99 00 11 22",
  website: "awa-shop.cm",
  consent: true,
});

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
  await connectDatabase(mongo.getUri(), "test-leads");
  await Lead.syncIndexes();
}, 120_000);

afterAll(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});

beforeEach(() => {
  sent.length = 0;
});

describe("POST /leads", () => {
  it("enregistre la demande, normalise les champs et envoie les deux emails", async () => {
    const body = validLead();
    const res = await request(app).post("/api/v1/leads").send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.reference).toMatch(/^MB-[2-9A-HJ-NP-Z]{6}$/);

    const lead = await Lead.findOne({ submissionId: body.submissionId }).lean();
    expect(lead?.email).toBe("awa@example.com");
    expect(lead?.whatsapp).toBe("237699001122");
    expect(lead?.website).toBe("https://awa-shop.cm");
    expect(lead?.status).toBe("new");
    expect(lead?.consent?.given).toBe(true);
    expect(lead?.emails?.confirmation?.status).toBe("sent");
    expect(lead?.emails?.notification?.status).toBe("sent");

    expect(sent.map((m) => m.to).sort()).toEqual(["awa@example.com", "charles@example.com"]);
    expect(sent.find((m) => m.to === "charles@example.com")?.replyTo).toBe("awa@example.com");
  });

  it("une même soumission renvoyée ne crée pas de doublon et ne renvoie pas d'email", async () => {
    const body = validLead();
    const first = await request(app).post("/api/v1/leads").send(body);
    sent.length = 0;
    const second = await request(app).post("/api/v1/leads").send(body);
    expect(second.status).toBe(200);
    expect(second.body.data.reference).toBe(first.body.data.reference);
    expect(await Lead.countDocuments({ submissionId: body.submissionId })).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it("rejette les champs invalides avec le détail par champ", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .send({ ...validLead(), email: "pas-un-email", goal: "court", consent: false });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(res.body.error.fieldErrors)).toEqual(expect.arrayContaining(["email", "goal", "consent"]));
  });

  it("refuse un champ inconnu (pas de statut ou de note glissés par le navigateur)", async () => {
    const res = await request(app)
      .post("/api/v1/leads")
      .send({ ...validLead(), status: "won" });
    expect(res.status).toBe(400);
  });

  it("le champ piège rempli n'enregistre rien et n'envoie rien", async () => {
    const body = { ...validLead(), hp: "http://spam.example" };
    const res = await request(app).post("/api/v1/leads").send(body);
    expect(res.status).toBe(202);
    expect(await Lead.countDocuments({ submissionId: body.submissionId })).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("le contenu saisi est échappé dans les emails HTML", async () => {
    await request(app)
      .post("/api/v1/leads")
      .send({ ...validLead(), goal: "<script>alert('x')</script> une boutique en ligne complète" });
    const html = sent.map((m) => m.html).join("");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("limitation de débit", () => {
  it("bloque le formulaire au-delà du nombre d'envois autorisés", async () => {
    const strict = createApp(config, createLogger("silent"), { mailer, leadsRateLimit: 2 });
    const statuses = [];
    for (let i = 0; i < 3; i++) statuses.push((await request(strict).post("/api/v1/leads").send(validLead())).status);
    expect(statuses).toEqual([201, 201, 429]);
  });
});
