import type { PrismaClient } from "@prisma/client";

const REPEAT_UNIT_DAY = "day";
const REPEAT_UNIT_WEEK = "week";
const REPEAT_UNIT_MONTH = "month";

/** Add N days to a dateKey "YYYY-MM-DD", return dateKey. Uses UTC noon to avoid DST. */
function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Parse dateKey to Date at UTC midnight for storage (forDate). */
function dateKeyToDate(dateKey: string): Date {
  return new Date(dateKey + "T00:00:00.000Z");
}

/** Get day of week in ISO form (1 = Monday, 7 = Sunday). */
function getISODayOfWeek(d: Date): number {
  const day = d.getUTCDay(); // 0 = Sun, 6 = Sat
  return day === 0 ? 7 : day;
}

/** Return true if the interval has an occurrence on the given dateKey (YYYY-MM-DD). */
function intervalOccursOnDate(
  interval: {
    customRepeatDates: string | null;
    customRepeatRule: string | null;
    repeatValue: number;
    repeatUnit: string | null;
    endTime: Date | null;
    createdAt: Date;
  },
  dateKey: string
): boolean {
  const date = new Date(dateKey + "T12:00:00.000Z");
  if (interval.endTime != null && date > interval.endTime) return false;

  // 1) Explicit list of dates
  if (interval.customRepeatDates != null && interval.customRepeatDates !== "") {
    try {
      const arr = JSON.parse(interval.customRepeatDates) as string[];
      if (Array.isArray(arr)) {
        const match = arr.some((s) => String(s).slice(0, 10) === dateKey);
        if (match) return true;
        // If customRepeatDates is set and date not in list, no occurrence (unless repeatUnit also applies - schema says "and/or")
        // We treat customRepeatDates as override: if present and date in list, yes; if present and date not in list, no.
        if (arr.length > 0) return false;
      }
    } catch {
      // fall through
    }
  }

  // 2) customRepeatRule: { unit: "week", daysOfWeek } | { unit: "month", daysOfMonth } | { unit: "year", months, daysOfMonth? }
  if (interval.customRepeatRule != null && interval.customRepeatRule !== "") {
    try {
      const rule = JSON.parse(interval.customRepeatRule) as {
        unit?: string;
        daysOfWeek?: number[];
        daysOfMonth?: number[];
        months?: number[];
      };
      if (rule.unit === "week" && Array.isArray(rule.daysOfWeek)) {
        const dow = getISODayOfWeek(date);
        if (rule.daysOfWeek.includes(dow)) {
          if (!interval.repeatUnit || interval.repeatValue <= 0) return true;
          return dateMatchesRepeatFromAnchor(
            interval.createdAt,
            date,
            interval.repeatValue,
            interval.repeatUnit
          );
        }
        return false;
      }
      if (rule.unit === "month" && Array.isArray(rule.daysOfMonth)) {
        const dom = date.getUTCDate();
        if (rule.daysOfMonth.includes(dom)) {
          if (!interval.repeatUnit || interval.repeatValue <= 0) return true;
          return dateMatchesRepeatFromAnchor(
            interval.createdAt,
            date,
            interval.repeatValue,
            interval.repeatUnit
          );
        }
        return false;
      }
      if (rule.unit === "year" && Array.isArray(rule.months)) {
        const month = date.getUTCMonth() + 1; // 1-12
        if (!rule.months.includes(month)) return false;
        if (Array.isArray(rule.daysOfMonth) && rule.daysOfMonth.length > 0) {
          const dom = date.getUTCDate();
          if (!rule.daysOfMonth.includes(dom)) return false;
        }
        if (!interval.repeatUnit || interval.repeatValue <= 0) return true;
        return dateMatchesRepeatFromAnchor(
          interval.createdAt,
          date,
          interval.repeatValue,
          interval.repeatUnit
        );
      }
    } catch {
      // fall through
    }
  }

  // 3) repeatValue + repeatUnit from anchor (createdAt)
  if (interval.repeatUnit != null && interval.repeatValue > 0) {
    return dateMatchesRepeatFromAnchor(
      interval.createdAt,
      date,
      interval.repeatValue,
      interval.repeatUnit
    );
  }

  // No rule: no occurrence
  return false;
}

/** True if date is exactly (anchor + N * repeatValue repeatUnit) for some N >= 0. */
function dateMatchesRepeatFromAnchor(
  anchor: Date,
  date: Date,
  repeatValue: number,
  repeatUnit: string
): boolean {
  const anchorDay = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate()));
  const targetDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  if (targetDay < anchorDay) return false;

  const diffMs = targetDay.getTime() - anchorDay.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));

  switch (repeatUnit) {
    case REPEAT_UNIT_DAY:
      return diffDays >= 0 && diffDays % repeatValue === 0;
    case REPEAT_UNIT_WEEK: {
      const diffWeeks = diffDays / 7;
      return diffWeeks >= 0 && Number.isInteger(diffWeeks) && diffWeeks % repeatValue === 0;
    }
    case REPEAT_UNIT_MONTH: {
      const months =
        (targetDay.getUTCFullYear() - anchorDay.getUTCFullYear()) * 12 +
        (targetDay.getUTCMonth() - anchorDay.getUTCMonth());
      return months >= 0 && months % repeatValue === 0 && targetDay.getUTCDate() === anchorDay.getUTCDate();
    }
    default:
      return false;
  }
}

/** Parse routine timeOfDayBlocks JSON; return array of "HH:mm". */
function getRoutineTimeBlocks(timeOfDayBlocks: string | null): string[] {
  if (timeOfDayBlocks == null || timeOfDayBlocks === "") return [];
  try {
    const arr = JSON.parse(timeOfDayBlocks) as string[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((s) => String(s).trim().slice(0, 5))
      .filter((s) => /^\d{2}:\d{2}$/.test(s));
  } catch {
    return [];
  }
}

/** Return true if routine has at least one occurrence on the given date (e.g. daily). */
function routineOccursOnDate(
  routine: { endTime: Date | null; timeOfDayBlocks: string | null },
  _dateKey: string
): boolean {
  const date = new Date(_dateKey + "T12:00:00.000Z");
  if (routine.endTime != null && date > routine.endTime) return false;
  const blocks = getRoutineTimeBlocks(routine.timeOfDayBlocks);
  return blocks.length > 0;
}

/** Get one occurrence per time block for the routine on the given date. */
function getRoutineOccurrencesForDate(
  routine: { timeOfDayBlocks: string | null; title: string; estimatedTimeMinutes: number | null }
): { startTimeOfDay: string }[] {
  const blocks = getRoutineTimeBlocks(routine.timeOfDayBlocks);
  if (blocks.length === 0) return [{ startTimeOfDay: "09:00" }]; // fallback
  return blocks.map((startTimeOfDay) => ({ startTimeOfDay }));
}

/** Get dateKeys to gather: today, today+1, today+2. */
export function getGatheringDateKeys(todayDateKey: string): string[] {
  return [
    todayDateKey,
    addDaysToDateKey(todayDateKey, 1),
    addDaysToDateKey(todayDateKey, 2),
  ];
}

export type ActionGatheringOptions = {
  /** Current local date "YYYY-MM-DD" (used to compute today, today+1, today+2). */
  todayDateKey: string;
  /** If true, only gather for dates that don't have actionGatheringCompletedAt. */
  skipCompletedDates?: boolean;
};

/**
 * Run action gathering for today, today+1, today+2 (or subset).
 * Creates gathered Actions from intervals and routines, and sets actionGatheringCompletedAt on DayState.
 */
export async function runActionGathering(
  prisma: PrismaClient,
  userId: string,
  options: ActionGatheringOptions
): Promise<{ dateKeysProcessed: string[]; actionsCreated: number }> {
  const { todayDateKey, skipCompletedDates = true } = options;
  const dateKeys = getGatheringDateKeys(todayDateKey);
  let actionsCreated = 0;
  const dateKeysProcessed: string[] = [];

  const intervals = await prisma.interval.findMany({
    where: { userId, status: "active" },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  const routines = await prisma.routine.findMany({
    where: { userId, status: "active" },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  for (const dateKey of dateKeys) {
    if (skipCompletedDates) {
      const existing = await prisma.dayState.findUnique({
        where: { userId_dateKey: { userId, dateKey } },
      });
      if (existing?.actionGatheringCompletedAt != null) continue;
    }

    const forDate = dateKeyToDate(dateKey);

    // ---- Intervals: one action per interval per date (if occurs)
    for (const interval of intervals) {
      if (!intervalOccursOnDate(interval, dateKey)) continue;

      const existing = await prisma.action.findFirst({
        where: {
          userId,
          forDate,
          sourceType: "interval",
          sourceId: interval.id,
          isGathered: true,
        },
      });
      if (existing) continue;

      const startTimeOfDay =
        interval.predictedToDoTime && /^\d{2}:\d{2}$/.test(interval.predictedToDoTime)
          ? interval.predictedToDoTime
          : undefined;
      await prisma.action.create({
        data: {
          userId,
          title: interval.title,
          estimatedTimeMinutes: interval.estimatedTimeMinutes ?? undefined,
          startTimeOfDay: startTimeOfDay ?? undefined,
          forDate,
          sourceType: "interval",
          sourceId: interval.id,
          isGathered: true,
          priority: "P",
        },
      });
      actionsCreated++;
    }

    // ---- Routines: one action per routine per date per time block
    for (const routine of routines) {
      if (!routineOccursOnDate(routine, dateKey)) continue;

      const occurrences = getRoutineOccurrencesForDate(routine);
      for (const { startTimeOfDay } of occurrences) {
        const existing = await prisma.action.findFirst({
          where: {
            userId,
            forDate,
            sourceType: "routine",
            sourceId: routine.id,
            startTimeOfDay,
            isGathered: true,
          },
        });
        if (existing) continue;

        await prisma.action.create({
          data: {
            userId,
            title: routine.title,
            estimatedTimeMinutes: routine.estimatedTimeMinutes ?? undefined,
            startTimeOfDay,
            forDate,
            sourceType: "routine",
            sourceId: routine.id,
            isGathered: true,
            priority: "P",
          },
        });
        actionsCreated++;
      }
    }

    // Mark this date's gathering as complete
    await prisma.dayState.upsert({
      where: { userId_dateKey: { userId, dateKey } },
      create: {
        userId,
        dateKey,
        actionGatheringCompletedAt: new Date(),
      },
      update: { actionGatheringCompletedAt: new Date() },
    });
    dateKeysProcessed.push(dateKey);
  }

  return { dateKeysProcessed, actionsCreated };
}
