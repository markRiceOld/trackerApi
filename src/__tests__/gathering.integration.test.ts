import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { prisma, clearDb, createTestUser } from "../test/helpers";
import { runActionGathering } from "../services/actionGathering";

const TODAY = "2025-06-10";

beforeEach(async () => {
  await clearDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeActiveInterval(userId: string, overrides?: object) {
  return prisma.interval.create({
    data: {
      title: "Daily standup",
      status: "active",
      estimatedTimeMinutes: 15,
      repeatValue: 1,
      repeatUnit: "day",
      userId,
      // Anchor must be before TODAY so dateMatchesRepeatFromAnchor works
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      ...overrides,
    },
  });
}

describe("runActionGathering", () => {
  it("creates gathered actions for today, today+1, today+2", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(3);
    expect(result.dateKeysProcessed).toEqual(["2025-06-10", "2025-06-11", "2025-06-12"]);
    const actions = await prisma.action.findMany({ where: { userId: user.id, isGathered: true } });
    expect(actions).toHaveLength(3);
  });

  it("is idempotent — re-running does not duplicate actions", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    const second = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(second.actionsCreated).toBe(0);
    const actions = await prisma.action.findMany({ where: { userId: user.id, isGathered: true } });
    expect(actions).toHaveLength(3);
  });

  it("skips dates that already have actionGatheringCompletedAt (skipCompletedDates=true)", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id);
    // Pre-mark today as gathered
    await prisma.dayState.create({
      data: { userId: user.id, dateKey: TODAY, actionGatheringCompletedAt: new Date() },
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: true });
    // Only tomorrow and day-after should be gathered
    expect(result.actionsCreated).toBe(2);
    expect(result.dateKeysProcessed).not.toContain(TODAY);
  });

  it("respects endTime — does not create actions after interval ends", async () => {
    const user = await createTestUser();
    // endTime is before today+1
    await makeActiveInterval(user.id, {
      endTime: new Date("2025-06-10T23:59:59.000Z"),
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(1); // only today
  });

  it("does not gather from inactive intervals", async () => {
    const user = await createTestUser();
    await makeActiveInterval(user.id, { status: "inactive" });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    expect(result.actionsCreated).toBe(0);
  });

  it("creates one action per time block from customRepeatRule", async () => {
    const user = await createTestUser();
    // repeatUnit governs occurrence; timeOfDayBlocks inside customRepeatRule controls how many actions per occurrence
    await makeActiveInterval(user.id, {
      customRepeatRule: JSON.stringify({ unit: "day", timeOfDayBlocks: ["08:00", "17:00"] }),
    });
    const result = await runActionGathering(prisma, user.id, { todayDateKey: TODAY, skipCompletedDates: false });
    // 2 blocks × 3 days
    expect(result.actionsCreated).toBe(6);
  });
});
