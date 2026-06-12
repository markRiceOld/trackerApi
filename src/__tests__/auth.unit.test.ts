import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { signToken, requireAuth, ensureOwned } from "../graphql/auth";

describe("signToken", () => {
  it("produces a verifiable JWT containing userId", () => {
    const token = signToken({ id: "user-1" });
    const decoded = jwt.verify(token, "test-secret-key") as jwt.JwtPayload;
    expect(decoded.userId).toBe("user-1");
  });

  it("token expires in approximately 7 days", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signToken({ id: "user-2" });
    const decoded = jwt.verify(token, "test-secret-key") as jwt.JwtPayload;
    const sevenDays = 7 * 24 * 60 * 60;
    expect(decoded.exp! - before).toBeGreaterThanOrEqual(sevenDays - 5);
    expect(decoded.exp! - before).toBeLessThanOrEqual(sevenDays + 5);
  });
});

describe("requireAuth", () => {
  it("throws Unauthorized when ctx.user is absent", async () => {
    const wrapped = requireAuth(async () => "ok");
    await expect(wrapped(null, {}, { user: null })).rejects.toThrow("Unauthorized");
  });

  it("calls through to resolver when ctx.user is present and no prisma provided", async () => {
    const wrapped = requireAuth(async (_p, _a, ctx) => ctx.user.id);
    const result = await wrapped(null, {}, { user: { id: "u1" } });
    expect(result).toBe("u1");
  });
});

describe("ensureOwned", () => {
  it("throws Not found when resource is null", () => {
    expect(() => ensureOwned(null, { user: { id: "u1" } })).toThrow("Not found");
  });

  it("throws Not found when userId does not match", () => {
    expect(() =>
      ensureOwned({ userId: "other" }, { user: { id: "u1" } })
    ).toThrow("Not found");
  });

  it("does not throw when userId matches", () => {
    expect(() =>
      ensureOwned({ userId: "u1" }, { user: { id: "u1" } })
    ).not.toThrow();
  });
});
