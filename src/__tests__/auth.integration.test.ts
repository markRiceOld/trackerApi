import { describe, it, expect, beforeEach, afterAll } from "vitest";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { prisma, clearDb, createTestUser } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { requireAuth } from "../graphql/auth";

const ctx = { prisma };

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("register", () => {
  it("creates a new user and returns a valid JWT", async () => {
    const result = await mutationResolvers.register(null, { email: "a@example.com", password: "pass123" }, ctx);
    expect(result.user.email).toBe("a@example.com");
    const decoded = jwt.verify(result.token, "test-secret-key") as jwt.JwtPayload;
    expect(decoded.userId).toBe(result.user.id);
  });

  it("throws when email is already taken", async () => {
    await mutationResolvers.register(null, { email: "dup@example.com", password: "pass" }, ctx);
    await expect(
      mutationResolvers.register(null, { email: "dup@example.com", password: "other" }, ctx)
    ).rejects.toThrow("Email already in use");
  });
});

describe("login", () => {
  it("returns a JWT for correct credentials", async () => {
    await mutationResolvers.register(null, { email: "user@example.com", password: "secret" }, ctx);
    const result = await mutationResolvers.login(null, { email: "user@example.com", password: "secret" }, ctx);
    expect(result.user.email).toBe("user@example.com");
    const decoded = jwt.verify(result.token, "test-secret-key") as jwt.JwtPayload;
    expect(decoded.userId).toBe(result.user.id);
  });

  it("throws for wrong password", async () => {
    await mutationResolvers.register(null, { email: "user@example.com", password: "secret" }, ctx);
    await expect(
      mutationResolvers.login(null, { email: "user@example.com", password: "wrong" }, ctx)
    ).rejects.toThrow("Incorrect password");
  });

  it("throws for unknown email", async () => {
    await expect(
      mutationResolvers.login(null, { email: "ghost@example.com", password: "x" }, ctx)
    ).rejects.toThrow("User not found");
  });
});

describe("requireAuth DB validation", () => {
  it("throws Unauthorized when token references a deleted user", async () => {
    const user = await createTestUser();
    const userCtx = { user: { id: user.id }, prisma };
    await prisma.user.delete({ where: { id: user.id } });
    const wrapped = requireAuth(async () => "ok");
    await expect(wrapped(null, {}, userCtx)).rejects.toThrow("Unauthorized");
  });
});
