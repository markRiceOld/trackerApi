import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("addGoal", () => {
  it("creates a plain goal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "Launch product" }, ctx);
    expect(goal.title).toBe("Launch product");
    expect(goal.userId).toBe(user.id);
    expect(goal.isGoalGroup).toBe(false);
  });

  it("creates a goal group", async () => {
    const user = await createTestUser();
    const goal = await mutationResolvers.addGoal(null, { title: "Q1 Goals", isGoalGroup: true }, makeCtx(user));
    expect(goal.isGoalGroup).toBe(true);
  });

  it("rejects setting both parentGoalId and parentMilestoneId", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const parent = await mutationResolvers.addGoal(null, { title: "Parent" }, ctx);
    const milestone = await mutationResolvers.addMilestone(null, { goalId: parent.id, title: "M" }, ctx);
    await expect(
      mutationResolvers.addGoal(null, {
        title: "Child",
        parentGoalId: parent.id,
        parentMilestoneId: milestone.id,
      }, ctx)
    ).rejects.toThrow("cannot have both");
  });
});

describe("updateGoal", () => {
  it("updates the title and dod", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "Old" }, ctx);
    const updated = await mutationResolvers.updateGoal(null, { id: goal.id, title: "New", dod: "Ship it" }, ctx);
    expect(updated.title).toBe("New");
    expect(updated.dod).toBe("Ship it");
  });
});

describe("deleteGoal", () => {
  it("removes the goal", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "Temp" }, ctx);
    await mutationResolvers.deleteGoal(null, { id: goal.id }, ctx);
    const found = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(found).toBeNull();
  });
});

describe("saveDodClarity", () => {
  it("saves status and flagged dimensions", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const updated = await mutationResolvers.saveDodClarity(null, {
      id: goal.id,
      dodClarityStatus: "amber",
      dodFlaggedDimensions: ["measurable", "timebound"],
    }, ctx);
    expect(updated.dodClarityStatus).toBe("amber");
    // dodFlaggedDimensions stored as JSON string in DB
    expect(JSON.parse(updated.dodFlaggedDimensions!)).toEqual(["measurable", "timebound"]);
  });
});

describe("ownership", () => {
  it("rejects update of another user's goal", async () => {
    const user1 = await createTestUser({ email: "u1@example.com" });
    const user2 = await createTestUser({ email: "u2@example.com" });
    const goal = await mutationResolvers.addGoal(null, { title: "Mine" }, makeCtx(user1));
    await expect(
      mutationResolvers.updateGoal(null, { id: goal.id, title: "Stolen" }, makeCtx(user2))
    ).rejects.toThrow("Not found");
  });
});
