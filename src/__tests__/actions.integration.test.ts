import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("addAction", () => {
  it("creates a standalone action", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Buy milk" }, ctx);
    expect(action.title).toBe("Buy milk");
    expect(action.userId).toBe(user.id);
    expect(action.done).toBe(false);
  });

  it("links action to an owned project", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await mutationResolvers.addProject(null, { title: "Project A" }, ctx);
    const action = await mutationResolvers.addAction(null, { title: "Task 1", projectId: project.id }, ctx);
    expect(action.projectId).toBe(project.id);
  });

  it("requires estimatedTimeMinutes when tbd is set", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    await expect(
      mutationResolvers.addAction(null, { title: "Timed task", tbd: "2025-06-01T00:00:00.000Z" }, ctx)
    ).rejects.toThrow("estimatedTimeMinutes is required");
  });

  it("rejects linking to another user's project", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const project = await mutationResolvers.addProject(null, { title: "P" }, makeCtx(user1));
    await expect(
      mutationResolvers.addAction(null, { title: "Steal", projectId: project.id }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });
});

describe("updateAction", () => {
  it("updates the title", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Old" }, ctx);
    const updated = await mutationResolvers.updateAction(null, { id: action.id, title: "New" }, ctx);
    expect(updated.title).toBe("New");
  });

  it("rejects updating another user's action", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const action = await mutationResolvers.addAction(null, { title: "Mine" }, makeCtx(user1));
    await expect(
      mutationResolvers.updateAction(null, { id: action.id, title: "Stolen" }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });
});

describe("deleteAction", () => {
  it("removes the action", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Temp" }, ctx);
    await mutationResolvers.deleteAction(null, { id: action.id }, ctx);
    const found = await prisma.action.findUnique({ where: { id: action.id } });
    expect(found).toBeNull();
  });
});

describe("toggleAction", () => {
  it("marks action done then undone", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const action = await mutationResolvers.addAction(null, { title: "Toggle me" }, ctx);
    expect(action.done).toBe(false);
    const done = await mutationResolvers.toggleAction(null, { id: action.id }, ctx);
    expect(done.done).toBe(true);
    const undone = await mutationResolvers.toggleAction(null, { id: action.id }, ctx);
    expect(undone.done).toBe(false);
  });
});
