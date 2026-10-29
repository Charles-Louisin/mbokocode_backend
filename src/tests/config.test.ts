import { describe, expect, it } from "vitest";
import { loadConfig } from "../config/env.js";
import { applyUploadThingTokenAlias } from "../config/uploadthing.js";
import { PricingPackage } from "../modules/pricing/pricing.model.js";
import { Project } from "../modules/projects/project.model.js";
import { SiteSettings } from "../modules/settings/settings.model.js";
import { seedPricing, seedProjects, seedSettings } from "../scripts/seed-data.js";

describe("configuration", () => {
  it("applique les valeurs par défaut et découpe ALLOWED_ORIGINS", () => {
    const config = loadConfig({ ALLOWED_ORIGINS: "http://localhost:3000, https://mboko.example" });
    expect(config.PORT).toBe(5000);
    expect(config.ALLOWED_ORIGINS).toEqual(["http://localhost:3000", "https://mboko.example"]);
  });

  it("exige MONGODB_URI en production, sans révéler les valeurs", () => {
    const secret = "super-secret-value";
    expect(() => loadConfig({ NODE_ENV: "production", BETTER_AUTH_SECRET: secret })).toThrow(/MONGODB_URI/);
    try {
      loadConfig({ NODE_ENV: "production", PORT: secret });
    } catch (err) {
      expect((err as Error).message).not.toContain(secret);
    }
  });
});

describe("UploadThing", () => {
  it("UPLOADTHING8TOKEN est prioritaire et mappé vers UPLOADTHING_TOKEN", () => {
    const env: NodeJS.ProcessEnv = { UPLOADTHING8TOKEN: "custom", UPLOADTHING_TOKEN: "standard" };
    expect(applyUploadThingTokenAlias(env)).toBe(true);
    expect(env.UPLOADTHING_TOKEN).toBe("custom");
  });

  it("reste compatible avec le nom standard seul", () => {
    const env: NodeJS.ProcessEnv = { UPLOADTHING_TOKEN: "standard" };
    expect(applyUploadThingTokenAlias(env)).toBe(true);
    expect(env.UPLOADTHING_TOKEN).toBe("standard");
  });

  it("signale l'absence de configuration", () => {
    expect(applyUploadThingTokenAlias({ UPLOADTHING8TOKEN: "  " })).toBe(false);
  });
});

describe("contenu initial", () => {
  it("chaque projet respecte le schéma", async () => {
    for (const project of seedProjects) {
      await expect(new Project(project).validate(), project.slug).resolves.toBeUndefined();
    }
  });

  it("chaque offre respecte le schéma et la règle de prix", async () => {
    for (const offer of seedPricing) {
      await expect(new PricingPackage(offer).validate(), offer.slug).resolves.toBeUndefined();
    }
  });

  it("une offre « à partir de » sans prix est refusée", async () => {
    const offer = new PricingPackage({ name: "Test", slug: "test", description: "x", priceType: "from" });
    await expect(offer.validate()).rejects.toThrow(/priceMin/);
  });

  it("les réglages du site respectent le schéma", async () => {
    await expect(new SiteSettings(seedSettings).validate()).resolves.toBeUndefined();
  });
});

describe("destinataire des notifications", () => {
  it("utilise ADMIN_NOTIFICATION_EMAIL en priorité, sinon la première adresse valide d'ADMIN_EMAILS", async () => {
    const { notificationRecipient } = await import("../services/email/mailer.js");
    expect(notificationRecipient({ ADMIN_NOTIFICATION_EMAIL: "a@x.fr", ADMIN_EMAILS: "b@x.fr" })).toBe("a@x.fr");
    expect(notificationRecipient({ ADMIN_NOTIFICATION_EMAIL: undefined, ADMIN_EMAILS: " pas-un-email , b@x.fr" })).toBe("b@x.fr");
    expect(notificationRecipient({ ADMIN_NOTIFICATION_EMAIL: undefined, ADMIN_EMAILS: undefined })).toBeUndefined();
  });
});
