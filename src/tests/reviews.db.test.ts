import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db/connection.js";
import { createLogger } from "../logger.js";
import { AdminActivity } from "../modules/admin/activity.model.js";
import { Review } from "../modules/reviews/review.model.js";
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

/** Connexion complète par lien email : demande, lecture du lien reçu, ouverture → cookie de session. */
async function signIn(email: string): Promise<string> {
  sent.length = 0;
  await request(app)
    .post("/api/auth/sign-in/magic-link")
    .set("Origin", ORIGIN)
    .send({ email, callbackURL: "/compte" })
    .expect(200);
  const link = sent.find((message) => message.to === email)?.text.match(/https?:\/\/\S+/)?.[0];
  expect(link).toBeTruthy();
  const url = new URL(link!);
  const response = await request(app).get(`${url.pathname}${url.search}`).set("Origin", ORIGIN);
  expect(response.status).toBe(302);
  const cookies = ([] as string[]).concat(response.headers["set-cookie"] ?? []);
  const session = cookies.map((cookie) => cookie.split(";")[0]).join("; ");
  expect(session).toContain("session_token");
  return session;
}

const validReview = () => ({
  rating: 5,
  title: "Un site qui tient ses promesses",
  content: "Charles a livré notre boutique dans les délais, avec un vrai suivi à chaque étape.",
  authorName: "Awa N.",
  authorRole: "Fondatrice, Awa Shop",
  relationshipType: "client",
  consent: true,
});

let awa: string;
let bob: string;
let admin: string;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
  await connectDatabase(mongo.getUri(), "test-reviews");
  await Review.syncIndexes();
  awa = await signIn("awa@example.com");
  bob = await signIn("bob@example.com");
  admin = await signIn("charles@example.com");
}, 120_000);

afterAll(async () => {
  await disconnectDatabase();
  await mongo?.stop();
});

beforeEach(async () => {
  await Review.deleteMany({});
  sent.length = 0;
});

describe("connexion", () => {
  it("le lien de connexion est valable une seule fois", async () => {
    await request(app).post("/api/auth/sign-in/magic-link").set("Origin", ORIGIN).send({ email: "once@example.com" }).expect(200);
    const url = new URL(sent.at(-1)!.text.match(/https?:\/\/\S+/)![0]);
    const first = await request(app).get(`${url.pathname}${url.search}`);
    expect(String(first.headers["set-cookie"])).toContain("session_token");
    const second = await request(app).get(`${url.pathname}${url.search}`);
    expect(String(second.headers["set-cookie"] ?? "")).not.toContain("session_token=");
  });

  it("/me : 401 sans session, statut admin calculé côté serveur", async () => {
    await request(app).get("/api/v1/me").expect(401);
    const me = await request(app).get("/api/v1/me").set("Cookie", awa).expect(200);
    expect(me.body.data).toMatchObject({ email: "awa@example.com", isAdmin: false });
    const charles = await request(app).get("/api/v1/me").set("Cookie", admin).expect(200);
    expect(charles.body.data.isAdmin).toBe(true);
  });

  it("annonce uniquement les méthodes de connexion configurées", async () => {
    const res = await request(app).get("/api/v1/auth/providers").expect(200);
    expect(res.body.data).toEqual({ google: false, magicLink: true });
  });

  it("supprimer son compte supprime aussi son avis", async () => {
    const cookie = await signIn("depart@example.com");
    await request(app).post("/api/v1/reviews").set("Cookie", cookie).send(validReview()).expect(201);
    await request(app).post("/api/auth/delete-user").set("Origin", ORIGIN).set("Cookie", cookie).send({}).expect(200);
    expect(await Review.countDocuments()).toBe(0);
    await request(app).get("/api/v1/me").set("Cookie", cookie).expect(401);
  });

  it("le navigateur ne peut pas s'attribuer un rôle", async () => {
    await request(app)
      .post("/api/auth/update-user")
      .set("Origin", ORIGIN)
      .set("Cookie", awa)
      .send({ role: "admin", isAdmin: true })
      .expect((res) => expect(res.status).not.toBe(200));
    const me = await request(app).get("/api/v1/me").set("Cookie", awa).expect(200);
    expect(me.body.data.isAdmin).toBe(false);
  });
});

describe("avis", () => {
  it("connexion obligatoire pour publier", async () => {
    await request(app).post("/api/v1/reviews").send(validReview()).expect(401);
  });

  it("un nouvel avis est publié directement, et Charles en est prévenu", async () => {
    const created = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    expect(created.body.data.status).toBe("approved");
    expect(created.body.data.isVerifiedClient).toBe(false);
    expect(sent.some((message) => message.to === "charles@example.com" && message.subject.includes("publié"))).toBe(true);

    const after = await request(app).get("/api/v1/reviews").expect(200);
    expect(after.body.data).toHaveLength(1);
    expect(after.body.meta.averageRating).toBe(5);
    // Aucune donnée interne dans la réponse publique.
    expect(after.body.data[0]).not.toHaveProperty("userId");
    expect(after.body.data[0]).not.toHaveProperty("moderationNote");
    expect(after.body.data[0]).not.toHaveProperty("status");
  });

  it("l'admin peut toujours retirer un avis publié", async () => {
    const created = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    await request(app).patch(`/api/v1/admin/reviews/${created.body.data.id}/status`).set("Cookie", admin).send({ status: "rejected" }).expect(200);
    expect((await request(app).get("/api/v1/reviews")).body.data).toEqual([]);
    await request(app).patch(`/api/v1/admin/reviews/${created.body.data.id}/status`).set("Cookie", admin).send({ status: "approved" }).expect(200);
    expect(await AdminActivity.countDocuments({ action: "review.approved" })).toBeGreaterThan(0);
  });

  it("refuse les champs réservés (statut, vérification, auteur)", async () => {
    for (const extra of [{ status: "approved" }, { isVerifiedClient: true }, { userId: "autre" }]) {
      const res = await request(app).post("/api/v1/reviews").set("Cookie", awa).send({ ...validReview(), ...extra }).expect(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect(await Review.countDocuments()).toBe(0);
  });

  it("valide la note, la longueur et l'accord de publication", async () => {
    const res = await request(app)
      .post("/api/v1/reviews")
      .set("Cookie", awa)
      .send({ ...validReview(), rating: 6, content: "Trop court", consent: false })
      .expect(400);
    expect(Object.keys(res.body.error.fieldErrors)).toEqual(expect.arrayContaining(["rating", "content", "consent"]));
  });

  it("un seul avis par compte", async () => {
    await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    const second = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("chacun ne gère que son propre avis", async () => {
    const created = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    const id = created.body.data.id as string;
    await request(app).patch(`/api/v1/reviews/${id}`).set("Cookie", bob).send({ rating: 1 }).expect(404);
    await request(app).delete(`/api/v1/reviews/${id}`).set("Cookie", bob).expect(404);
    const mine = await request(app).get("/api/v1/reviews/me").set("Cookie", bob).expect(200);
    expect(mine.body.data).toBeNull();
    expect((await Review.findById(id))?.rating).toBe(5);
  });

  it("une modification est publiée directement, sauf si l'admin a masqué l'avis ; l'auteur peut le supprimer", async () => {
    const created = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    const id = created.body.data.id as string;

    const updated = await request(app).patch(`/api/v1/reviews/${id}`).set("Cookie", awa).send({ rating: 4 }).expect(200);
    expect(updated.body.data.status).toBe("approved");
    expect((await request(app).get("/api/v1/reviews")).body.data[0].rating).toBe(4);

    await request(app).patch(`/api/v1/admin/reviews/${id}/status`).set("Cookie", admin).send({ status: "hidden", note: "Hors sujet" }).expect(200);
    const hidden = await request(app).patch(`/api/v1/reviews/${id}`).set("Cookie", awa).send({ rating: 3 }).expect(200);
    expect(hidden.body.data.status).toBe("hidden");
    expect((await request(app).get("/api/v1/reviews")).body.data).toEqual([]);
    await request(app).patch(`/api/v1/reviews/${id}`).set("Cookie", awa).send({ status: "approved" }).expect(400);

    await request(app).delete(`/api/v1/reviews/${id}`).set("Cookie", awa).expect(204);
    expect(await Review.countDocuments()).toBe(0);
  });
});

describe("modération", () => {
  it("routes admin : 401 sans session, 403 pour un utilisateur", async () => {
    await request(app).get("/api/v1/admin/reviews").expect(401);
    await request(app).get("/api/v1/admin/reviews").set("Cookie", awa).expect(403);
    await request(app).get("/api/v1/admin/reviews").set("Cookie", admin).expect(200);
  });

  it("le badge client vérifié exige une justification", async () => {
    const created = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    const id = created.body.data.id as string;
    await request(app).patch(`/api/v1/admin/reviews/${id}/verification`).set("Cookie", awa).send({ isVerifiedClient: true, note: "Facture 2026-14" }).expect(403);
    await request(app).patch(`/api/v1/admin/reviews/${id}/verification`).set("Cookie", admin).send({ isVerifiedClient: true }).expect(400);
    const ok = await request(app)
      .patch(`/api/v1/admin/reviews/${id}/verification`)
      .set("Cookie", admin)
      .send({ isVerifiedClient: true, note: "Projet livré en mars, facture émise" })
      .expect(200);
    expect(ok.body.data.isVerifiedClient).toBe(true);
  });

  it("masquer un avis le retire de la page publique", async () => {
    const created = await request(app).post("/api/v1/reviews").set("Cookie", awa).send(validReview()).expect(201);
    const id = created.body.data.id as string;
    await request(app).patch(`/api/v1/admin/reviews/${id}/status`).set("Cookie", admin).send({ status: "hidden", note: "Demande de l'auteur" }).expect(200);
    expect((await request(app).get("/api/v1/reviews")).body.data).toEqual([]);
  });
});
