import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../logger.js";
import { resetRatesCache, XAF_PER_EUR } from "../modules/rates/rates.routes.js";

const config = loadConfig({ NODE_ENV: "test", ALLOWED_ORIGINS: "http://localhost:3000" });
const respond = (body: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 503, json: async () => body })) as unknown as typeof fetch;

describe("taux de change", () => {
  beforeEach(() => resetRatesCache());

  it("euro à parité fixe, dollar au taux de la BCE", async () => {
    const app = createApp(config, createLogger("silent"), { ratesFetcher: respond({ date: "2026-10-30", rates: { USD: 1.1 } }) });
    const res = await request(app).get("/api/v1/rates").expect(200);
    expect(res.body.data.base).toBe("XAF");
    expect(res.body.data.eur).toBeCloseTo(1 / XAF_PER_EUR, 12);
    expect(res.body.data.usd).toBeCloseTo(1.1 / XAF_PER_EUR, 12);
    expect(res.body.data.usdDate).toBe("2026-10-30");
  });

  it("sans taux du dollar, aucun chiffre inventé", async () => {
    const app = createApp(config, createLogger("silent"), { ratesFetcher: respond({}, false) });
    const res = await request(app).get("/api/v1/rates").expect(200);
    expect(res.body.data.eur).toBeCloseTo(1 / XAF_PER_EUR, 12);
    expect(res.body.data.usd).toBeNull();
  });
});
