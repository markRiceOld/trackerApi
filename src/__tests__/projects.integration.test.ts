import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser, makeCtx } from "../test/helpers";
import { mutationResolvers } from "../graphql/resolvers/mutations";
import { typeResolvers } from "../graphql/resolvers/typeResolvers";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("addProject", () => {
  it("creates a project", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await mutationResolvers.addProject(null, { title: "My Project" }, ctx);
    expect(project.title).toBe("My Project");
    expect(project.userId).toBe(user.id);
  });

  it("creates project with inline actions", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await mutationResolvers.addProject(null, {
      title: "With Actions",
      actions: [{ title: "Step 1" }, { title: "Step 2" }],
    }, ctx);
    expect(project.actions).toHaveLength(2);
  });

  it("rejects setting both goalId and milestoneId", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const goal = await mutationResolvers.addGoal(null, { title: "G" }, ctx);
    const milestone = await mutationResolvers.addMilestone(null, { goalId: goal.id, title: "M" }, ctx);
    await expect(
      mutationResolvers.addProject(null, { title: "P", goalId: goal.id, milestoneId: milestone.id }, ctx)
    ).rejects.toThrow("Cannot set both goalId and milestoneId");
  });
});

describe("updateProject", () => {
  it("updates the title and type", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await mutationResolvers.addProject(null, { title: "Old" }, ctx);
    const updated = await mutationResolvers.updateProject(null, { id: project.id, title: "New", type: "team" }, ctx);
    expect(updated.title).toBe("New");
    expect(updated.type).toBe("team");
  });
});

describe("deleteProject", () => {
  it("removes the project and its actions", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await mutationResolvers.addProject(null, {
      title: "Doomed",
      actions: [{ title: "Child action" }],
    }, ctx);
    await mutationResolvers.deleteProject(null, { id: project.id }, ctx);
    const found = await prisma.project.findUnique({ where: { id: project.id } });
    expect(found).toBeNull();
    const actions = await prisma.action.findMany({ where: { projectId: project.id } });
    expect(actions).toHaveLength(0);
  });
});

describe("Project computed dates (typeResolvers)", () => {
  it("startDate is the minimum action.tbd", async () => {
    const user = await createTestUser();
    const ctx = makeCtx(user);
    const project = await prisma.project.create({
      data: {
        title: "Dated project",
        userId: user.id,
        actions: {
          create: [
            { title: "A1", tbd: new Date("2025-03-01T00:00:00Z"), estimatedTimeMinutes: 30, userId: user.id },
            { title: "A2", tbd: new Date("2025-04-15T00:00:00Z"), estimatedTimeMinutes: 30, userId: user.id },
          ],
        },
      },
      include: { actions: true, intervals: { select: { id: true, createdAt: true, endTime: true, status: true } } },
    });
    const startDate = typeResolvers.Project.startDate(project);
    expect(startDate).toBe("2025-03-01T00:00:00.000Z");
  });

  it("endDate excludes ignored (past-due incomplete) actions", async () => {
    const user = await createTestUser();
    const pastDate = new Date("2020-01-01T00:00:00Z"); // far in the past → ignored
    const futureDate = new Date("2030-06-01T00:00:00Z");
    const project = await prisma.project.create({
      data: {
        title: "Mixed project",
        userId: user.id,
        actions: {
          create: [
            { title: "Ignored", tbd: pastDate, estimatedTimeMinutes: 30, done: false, userId: user.id },
            { title: "Active", tbd: futureDate, estimatedTimeMinutes: 30, done: false, userId: user.id },
          ],
        },
      },
      include: { actions: true, intervals: { select: { id: true, createdAt: true, endTime: true, status: true } } },
    });
    const endDate = typeResolvers.Project.endDate(project);
    // Should use the active action's date, not the ignored past one
    expect(endDate).toBe("2030-06-01T00:00:00.000Z");
  });
});
