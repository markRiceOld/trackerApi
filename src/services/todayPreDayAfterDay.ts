import type { PrismaClient } from "@prisma/client";

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function addDays(dateKey: string, n: number): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dateKeyToDate(dateKey: string): Date {
  return new Date(dateKey + "T00:00:00.000Z");
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Minutes from midnight for "HH:mm". */
function timeToMinutes(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Overlap: [startA, startA+estA) vs [startB, startB+estB). */
function overlaps(
  startMinA: number,
  estMinA: number,
  startMinB: number,
  estMinB: number
): boolean {
  const endA = startMinA + (estMinA ?? 0);
  const endB = startMinB + (estMinB ?? 0);
  return startMinA < endB && startMinB < endA;
}

/** All actions for a single day: linked (tbd=date), standalone (tbd=date, no project), gathered (forDate=date). */
export async function getTodayActions(prisma: PrismaClient, userId: string, dateKey: string) {
  if (!DATE_KEY_REGEX.test(dateKey)) return [];
  const date = dateKeyToDate(dateKey);
  const nextDay = dateKeyToDate(addDays(dateKey, 1));

  const [byTbd, byForDate] = await Promise.all([
    prisma.action.findMany({
      where: {
        userId,
        tbd: { gte: date, lt: nextDay },
        actionFate: null,
      },
      include: { project: true },
    }),
    prisma.action.findMany({
      where: {
        userId,
        isGathered: true,
        forDate: { gte: date, lt: nextDay },
        actionFate: null,
      },
    }),
  ]);

  return [...byTbd, ...byForDate];
}

/** Pre-day status for date (today). */
export async function getPreDayStatus(
  prisma: PrismaClient,
  userId: string,
  dateKey: string
): Promise<{
  afterDayRequired: boolean;
  canAccessToday: boolean;
  actionsWithoutTime: any[];
  todayActionsWithOverlap: { action: any; overlapIds: string[] }[];
}> {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return {
      afterDayRequired: false,
      canAccessToday: true,
      actionsWithoutTime: [],
      todayActionsWithOverlap: [],
    };
  }

  const yesterdayKey = addDays(dateKey, -1);
  const [yesterdayState, todayState] = await Promise.all([
    prisma.dayState.findUnique({
      where: { userId_dateKey: { userId, dateKey: yesterdayKey } },
    }),
    prisma.dayState.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
    }),
  ]);
  const afterDayRequired = yesterdayState?.afterDayCompletedAt == null;
  const preDayDone = todayState?.preDayCompletedAt != null;
  const canAccessToday = !afterDayRequired && preDayDone;

  const todayActions = await getTodayActions(prisma, userId, dateKey);
  const actionsWithoutTime = todayActions.filter((a) => !a.startTimeOfDay);

  const withMinutes = todayActions
    .filter((a) => a.startTimeOfDay && /^\d{2}:\d{2}$/.test(a.startTimeOfDay))
    .map((a) => ({
      action: a,
      startMin: timeToMinutes(a.startTimeOfDay!),
      estMin: a.estimatedTimeMinutes ?? 0,
    }));

  const overlapIdsByActionId = new Map<string, string[]>();
  for (let i = 0; i < withMinutes.length; i++) {
    const a = withMinutes[i];
    const ids: string[] = [];
    for (let j = 0; j < withMinutes.length; j++) {
      if (i === j) continue;
      const b = withMinutes[j];
      if (overlaps(a.startMin, a.estMin, b.startMin, b.estMin)) ids.push(b.action.id);
    }
    overlapIdsByActionId.set(a.action.id, ids);
  }

  const todayActionsWithOverlap = todayActions.map((action) => ({
    action,
    overlapIds: action.startTimeOfDay
      ? overlapIdsByActionId.get(action.id) ?? []
      : [],
  }));

  return {
    afterDayRequired,
    canAccessToday,
    actionsWithoutTime,
    todayActionsWithOverlap,
  };
}

/** Not-done actions for date, grouped for After-day wizard. */
export async function getNotDoneActionsForDate(
  prisma: PrismaClient,
  userId: string,
  dateKey: string
): Promise<{
  nonLinkedGathered: any[];
  linkedGathered: any[];
  standalone: any[];
}> {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return { nonLinkedGathered: [], linkedGathered: [], standalone: [] };
  }

  const date = dateKeyToDate(dateKey);
  const nextDay = dateKeyToDate(addDays(dateKey, 1));

  const notDoneGathered = await prisma.action.findMany({
    where: {
      userId,
      isGathered: true,
      forDate: { gte: date, lt: nextDay },
      done: false,
      actionFate: null,
    },
  });

  const notDoneStandalone = await prisma.action.findMany({
    where: {
      userId,
      tbd: { gte: date, lt: nextDay },
      done: false,
      actionFate: null,
      projectId: null,
      isGathered: false,
    },
  });

  const intervalIds = notDoneGathered
    .filter((a) => a.sourceType === "interval" && a.sourceId)
    .map((a) => a.sourceId!);
  const linkedIntervalIds = new Set<string>();
  if (intervalIds.length > 0) {
    const intervals = await prisma.interval.findMany({
      where: { id: { in: intervalIds }, userId },
      select: { id: true, goalId: true, milestoneId: true, projectId: true },
    });
    for (const i of intervals) {
      if (i.goalId ?? i.milestoneId ?? i.projectId) linkedIntervalIds.add(i.id);
    }
  }

  const nonLinkedGathered: any[] = [];
  const linkedGathered: any[] = [];
  for (const a of notDoneGathered) {
    if (a.sourceType === "routine") {
      nonLinkedGathered.push(a);
    } else if (a.sourceType === "interval" && a.sourceId && linkedIntervalIds.has(a.sourceId)) {
      linkedGathered.push(a);
    } else {
      nonLinkedGathered.push(a);
    }
  }

  return {
    nonLinkedGathered,
    linkedGathered,
    standalone: notDoneStandalone,
  };
}
