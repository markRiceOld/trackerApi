import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser } from "../test/helpers";
import {
  getTodayActions,
  getNotDoneActionsForDate,
  getPreDayStatus,
} from "../services/todayPreDayAfterDay";

const DATE = "2025-06-10";
const DATE_OBJ = new Date("2025-06-10T00:00:00.000Z");
const OTHER_DATE = new Date("2025-06-11T00:00:00.000Z");

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("getTodayActions", () => {
  it("includes actions with tbd = today", async () => {
    const user = await createTestUser();
    await prisma.action.create({
      data: { title: "Tbd today", tbd: DATE_OBJ, estimatedTimeMinutes: 30, userId: user.id },
    });
    const actions = await getTodayActions(prisma, user.id, DATE);
    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe("Tbd today");
  });

  it("includes gathered actions for today (forDate = today)", async () => {
    const user = await createTestUser();
    await prisma.action.create({
      data: {
        title: "Gathered",
        isGathered: true,
        forDate: DATE_OBJ,
        estimatedTimeMinutes: 15,
        userId: user.id,
      },
    });
    const actions = await getTodayActions(prisma, user.id, DATE);
    expect(actions.some((a) => a.title === "Gathered")).toBe(true);
  });

  it("excludes actions with actionFate set", async () => {
    const user = await createTestUser();
    await prisma.action.create({
      data: {
        title: "Postponed",
        tbd: DATE_OBJ,
        estimatedTimeMinutes: 30,
        actionFate: "Postponed",
        userId: user.id,
      },
    });
    const actions = await getTodayActions(prisma, user.id, DATE);
    expect(actions).toHaveLength(0);
  });

  it("excludes actions for other dates", async () => {
    const user = await createTestUser();
    await prisma.action.create({
      data: { title: "Tomorrow", tbd: OTHER_DATE, estimatedTimeMinutes: 30, userId: user.id },
    });
    const actions = await getTodayActions(prisma, user.id, DATE);
    expect(actions).toHaveLength(0);
  });

  it("returns empty for invalid dateKey", async () => {
    const user = await createTestUser();
    const actions = await getTodayActions(prisma, user.id, "not-a-date");
    expect(actions).toHaveLength(0);
  });
});

describe("getNotDoneActionsForDate grouping", () => {
  it("separates routine gathered, linked interval gathered, and standalone", async () => {
    const user = await createTestUser();

    // Standalone (tbd = today, not gathered)
    await prisma.action.create({
      data: { title: "Standalone", tbd: DATE_OBJ, estimatedTimeMinutes: 30, userId: user.id },
    });

    // Routine-gathered
    const routine = await prisma.routine.create({
      data: {
        title: "Morning routine",
        status: "active",
        estimatedTimeMinutes: 20,
        timeOfDayBlocks: JSON.stringify(["07:00"]),
        userId: user.id,
      },
    });
    await prisma.action.create({
      data: {
        title: "Routine action",
        isGathered: true,
        forDate: DATE_OBJ,
        sourceType: "routine",
        sourceId: routine.id,
        userId: user.id,
      },
    });

    // Linked interval (interval scoped to a goal)
    const goal = await prisma.goal.create({ data: { title: "G", userId: user.id } });
    const interval = await prisma.interval.create({
      data: {
        title: "Weekly review",
        status: "active",
        estimatedTimeMinutes: 60,
        repeatValue: 1,
        repeatUnit: "week",
        goalId: goal.id,
        userId: user.id,
      },
    });
    await prisma.action.create({
      data: {
        title: "Linked interval action",
        isGathered: true,
        forDate: DATE_OBJ,
        sourceType: "interval",
        sourceId: interval.id,
        userId: user.id,
      },
    });

    const result = await getNotDoneActionsForDate(prisma, user.id, DATE);
    expect(result.standalone).toHaveLength(1);
    expect(result.standalone[0].title).toBe("Standalone");
    expect(result.nonLinkedGathered.some((a) => a.title === "Routine action")).toBe(true);
    expect(result.linkedGathered.some((a) => a.title === "Linked interval action")).toBe(true);
  });
});

describe("getPreDayStatus", () => {
  it("detects overlap between two timed actions", async () => {
    const user = await createTestUser();
    await prisma.action.createMany({
      data: [
        {
          title: "A",
          tbd: DATE_OBJ,
          startTimeOfDay: "09:00",
          estimatedTimeMinutes: 60,
          userId: user.id,
        },
        {
          title: "B",
          tbd: DATE_OBJ,
          startTimeOfDay: "09:30",
          estimatedTimeMinutes: 60,
          userId: user.id,
        },
      ],
    });
    const status = await getPreDayStatus(prisma, user.id, DATE);
    const withOverlap = status.todayActionsWithOverlap.filter((x) => x.overlapIds.length > 0);
    expect(withOverlap).toHaveLength(2);
  });

  it("actionsWithoutTime lists actions missing startTimeOfDay", async () => {
    const user = await createTestUser();
    await prisma.action.create({
      data: { title: "No time", tbd: DATE_OBJ, estimatedTimeMinutes: 30, userId: user.id },
    });
    const status = await getPreDayStatus(prisma, user.id, DATE);
    expect(status.actionsWithoutTime).toHaveLength(1);
  });
});
