import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { MemoryStore } from "../src/db";
import type { AppConfig } from "../src/config";

const testConfig: AppConfig = {
  port: 0,
  nodeEnv: "test",
  clientOrigin: "http://localhost:5173",
  demoFallback: true,
  saleSeasonWindowDays: 10
};

describe("TrueCost API", () => {
  it("analyzes supported URLs, stores recent products, and saves alerts", async () => {
    const store = new MemoryStore();
    const { app } = createApp({ appConfig: testConfig, store });

    const analyze = await request(app)
      .post("/api/analyze")
      .send({ url: "https://www.amazon.com/dp/B08N5WRWNW" })
      .expect(200);

    expect(analyze.body.product.id).toMatch(/^prd_/);
    expect(analyze.body.history.length).toBeGreaterThan(1);
    expect(analyze.body.offers.length).toBeGreaterThan(0);

    const recent = await request(app).get("/api/recent").expect(200);
    expect(recent.body.products).toHaveLength(1);

    const product = await request(app).get(`/api/products/${analyze.body.product.id}`).expect(200);
    expect(product.body.product.name).toBe(analyze.body.product.name);

    const alert = await request(app)
      .post("/api/alert")
      .send({ productId: analyze.body.product.id, email: "buyer@example.com", targetPrice: 50 })
      .expect(201);
    expect(alert.body.alert.email).toBe("buyer@example.com");
  });

  it("returns friendly unsupported-url errors", async () => {
    const { app } = createApp({ appConfig: testConfig, store: new MemoryStore() });
    const response = await request(app).post("/api/analyze").send({ url: "https://example.com/item" }).expect(400);
    expect(response.body.error.code).toBe("UNSUPPORTED_URL");
  });
});
