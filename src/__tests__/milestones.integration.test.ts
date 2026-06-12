import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("addMilestone", () => {
  it("creates a milestone with auto-incrementing order", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const m1 = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "Phase 1" }, ctx);
    const m2 = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "Phase 2" }, ctx);
    expect(m2.order).toBeGreaterThan(m1.order);
  });

  it("setting isLast=true clears isLast on all other milestones", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const first = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "M1", isLast: true }, ctx);
    expect(first.isLast).toBe(true);
    // Add a second isLast milestone — should demote the first
    const second = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "M2", isLast: true }, ctx);
    expect(second.isLast).toBe(true);
    const demoted = await prisma.milestone.findUnique({ where: { id: first.id } });
    expect(demoted!.isLast).toBe(false);
  });

  it("new non-isLast milestone inserts before existing isLast milestone", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const last = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "Last", isLast: true }, ctx);
    const middle = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "Middle" }, ctx);
    // middle should have the same order as last had (last gets bumped up)
    const refreshedLast = await prisma.milestone.findUnique({ where: { id: last.id } });
    expect(middle.order).toBeLessThan(refreshedLast!.order);
  });
});

describe("updateMilestone", () => {
  it("updates title and doa", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const m = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "Old" }, ctx);
    const updated = await mutationResolvers.updateMilestone(null, { id: m.id, title: "New", doa: "Shipped" }, ctx);
    expect(updated.title).toBe("New");
    expect(updated.doa).toBe("Shipped");
  });
});

describe("deleteMilestone", () => {
  it("removes the milestone", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const m = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "Delete me" }, ctx);
    await mutationResolvers.deleteMilestone(null, { id: m.id }, ctx);
    const found = await prisma.milestone.findUnique({ where: { id: m.id } });
    expect(found).toBeNull();
  });
});
