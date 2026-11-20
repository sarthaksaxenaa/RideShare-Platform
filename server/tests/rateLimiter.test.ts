import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import { authLimiter, apiLimiter, uploadLimiter } from "../src/middleware/rateLimiter.js";

/**
 * Builds a tiny app that mirrors production wiring: one trusted proxy hop
 * and the real limiter instances. Every test uses its own client IPs so the
 * in-memory counters of one test never affect another.
 */
function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use("/upload", uploadLimiter, (_req, res) => res.send("ok"));
  app.use("/auth", authLimiter, (_req, res) => res.send("ok"));
  app.use("/api", apiLimiter, (_req, res) => res.send("ok"));
  return app;
}

const hit = (app: express.Express, path: string, ip: string) =>
  request(app).get(path).set("X-Forwarded-For", ip);

describe("rate limiters", () => {
  it("allows requests up to the limit, then answers 429 with JSON and Retry-After", async () => {
    const app = buildApp();
    for (let i = 0; i < 10; i++) {
      expect((await hit(app, "/upload", "10.0.0.1")).status).toBe(200);
    }
    const blocked = await hit(app, "/upload", "10.0.0.1");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: "Too many requests. Please try again later." });
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("gives each client IP its own bucket (regression: all users used to share one)", async () => {
    const app = buildApp();
    for (let i = 0; i < 11; i++) await hit(app, "/upload", "10.0.1.1");
    expect((await hit(app, "/upload", "10.0.1.1")).status).toBe(429);
    // A different user behind the same proxy must be unaffected.
    expect((await hit(app, "/upload", "10.0.1.2")).status).toBe(200);
  });

  it("cannot be evaded by forging extra X-Forwarded-For entries", async () => {
    const app = buildApp();
    // The proxy appends the real client IP on the right. An attacker can only
    // forge what sits to the left of it.
    for (let i = 0; i < 10; i++) {
      await hit(app, "/upload", `evil-${i}, 10.0.2.1`);
    }
    expect((await hit(app, "/upload", "evil-new, 10.0.2.1")).status).toBe(429);
  });

  it("keeps counters separate between limiters (regression: one shared map)", async () => {
    const app = buildApp();
    // Spend most of the auth budget (limit 30) from one IP...
    for (let i = 0; i < 25; i++) await hit(app, "/auth", "10.0.3.1");
    // ...the stricter upload limiter (limit 10) must still start from zero.
    expect((await hit(app, "/upload", "10.0.3.1")).status).toBe(200);
    expect((await hit(app, "/api", "10.0.3.1")).status).toBe(200);
  });

  it("documents the failure mode when trust proxy is NOT set: all clients collapse into one bucket", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = express(); // deliberately no trust proxy
    app.use("/upload", uploadLimiter, (_req, res) => res.send("ok"));
    for (let i = 0; i < 10; i++) await hit(app, "/upload", "10.0.6.1");
    // A completely different client is blocked too: this is why index.ts sets trust proxy.
    expect((await hit(app, "/upload", "10.0.6.2")).status).toBe(429);
    quiet.mockRestore();
  });

  it("enforces the auth limit of 30 requests per window", async () => {
    const app = buildApp();
    for (let i = 0; i < 30; i++) {
      expect((await hit(app, "/auth", "10.0.4.1")).status).toBe(200);
    }
    expect((await hit(app, "/auth", "10.0.4.1")).status).toBe(429);
  });

  it("reports standard RateLimit headers and no legacy X-RateLimit headers", async () => {
    const app = buildApp();
    const res = await hit(app, "/api", "10.0.5.1");
    expect(res.headers["ratelimit"] ?? res.headers["ratelimit-policy"]).toBeDefined();
    expect(res.headers["x-ratelimit-limit"]).toBeUndefined();
  });
});
