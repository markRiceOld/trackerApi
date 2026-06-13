import { requireAuth } from "../auth";
import { getTodayActions, getPreDayStatus, getNotDoneActionsForDate } from "../../services/todayPreDayAfterDay";

const INTERVAL_DATES_SELECT = {
  select: { id: true, createdAt: true, endTime: true, status: true },
} as const;

const PROJECT_WITH_DATES_INCLUDE = {
  include: {
    actions: true,
    intervals: INTERVAL_DATES_SELECT,
  },
} as const;

export const queryResolvers = {
  actions: requireAuth((_, __, ctx) =>
    ctx.prisma.action.findMany({
      where: { userId: ctx.user.id },
      orderBy: { createdAt: "desc" },
    })
  ),
  action: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.action.findFirst({
      where: { id, userId: ctx.user.id },
    })
  ),
  projects: requireAuth((_, __, ctx) =>
    ctx.prisma.project.findMany({
      where: { userId: ctx.user.id },
      include: { actions: true, goal: true, milestone: true, intervals: INTERVAL_DATES_SELECT },
      orderBy: { createdAt: "desc" },
    })
  ),
  project: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.project.findFirst({
      where: { id, userId: ctx.user.id },
      include: { actions: true, goal: true, milestone: true, intervals: INTERVAL_DATES_SELECT },
    })
  ),
  goals: requireAuth((_, args: any, ctx) => {
    const where: any = { userId: ctx.user.id };
    if (args.includeAll === true) {
      return ctx.prisma.goal.findMany({
        where,
        include: {
          milestones: {
            include: {
              projects: PROJECT_WITH_DATES_INCLUDE,
              childGoals: { select: { id: true, title: true, isGoalGroup: true } },
            },
            orderBy: [{ isLast: "asc" }, { order: "asc" }],
          },
          projects: PROJECT_WITH_DATES_INCLUDE,
          childGoals: { select: { id: true, title: true, isGoalGroup: true } },
          intervals: INTERVAL_DATES_SELECT,
        },
        orderBy: { createdAt: "desc" },
      });
    }
    const hasParent = args.parentGoalId !== undefined || args.parentMilestoneId !== undefined;
    if (hasParent) {
      if (args.parentGoalId != null && args.parentMilestoneId != null) throw new Error("Use only one of parentGoalId or parentMilestoneId.");
      if (args.parentGoalId != null) where.parentGoalId = args.parentGoalId;
      else if (args.parentMilestoneId != null) where.parentMilestoneId = args.parentMilestoneId;
      else { where.parentGoalId = null; where.parentMilestoneId = null; }
    } else {
      where.parentGoalId = null;
      where.parentMilestoneId = null;
    }
    return ctx.prisma.goal.findMany({
      where,
      include: {
        milestones: {
          include: {
            projects: PROJECT_WITH_DATES_INCLUDE,
            childGoals: { select: { id: true, title: true, isGoalGroup: true } },
          },
          orderBy: [{ isLast: "asc" }, { order: "asc" }],
        },
        projects: PROJECT_WITH_DATES_INCLUDE,
        childGoals: { select: { id: true, title: true, isGoalGroup: true } },
        intervals: INTERVAL_DATES_SELECT,
      },
      orderBy: { createdAt: "desc" },
    });
  }),
  goal: requireAuth((_, args: any, ctx) =>
    ctx.prisma.goal.findFirst({
      where: { id: args.id, userId: ctx.user.id },
      include: {
        milestones: {
          include: {
            projects: {
              include: {
                actions: { select: { id: true, title: true, tbd: true, done: true } },
                intervals: INTERVAL_DATES_SELECT,
              },
            },
            childGoals: { select: { id: true, title: true, isGoalGroup: true } },
            intervals: { include: { steps: { orderBy: { order: "asc" } } } },
          },
          orderBy: [{ isLast: "asc" }, { order: "asc" }],
        },
        projects: {
          include: {
            actions: { select: { id: true, title: true, tbd: true, done: true } },
            intervals: INTERVAL_DATES_SELECT,
          },
        },
        childGoals: { select: { id: true, title: true, isGoalGroup: true } },
        intervals: { include: { steps: { orderBy: { order: "asc" } } } },
        parentGoal: { select: { id: true, title: true, isGoalGroup: true } },
        parentMilestone: { select: { id: true, title: true, goal: { select: { id: true, title: true } } } },
      },
    })
  ),
  intervals: requireAuth((_, __, ctx) =>
    ctx.prisma.interval.findMany({
      where: { userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
      orderBy: { createdAt: "desc" },
    })
  ),
  interval: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.interval.findFirst({
      where: { id, userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
    })
  ),
  routines: requireAuth((_, __, ctx) =>
    ctx.prisma.routine.findMany({
      where: { userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    })
  ),
  routine: requireAuth((_, { id }: any, ctx) =>
    ctx.prisma.routine.findFirst({
      where: { id, userId: ctx.user.id },
      include: { steps: { orderBy: { order: "asc" } } },
    })
  ),
  linkedActions: requireAuth((_, { date }: any, ctx) =>
    ctx.prisma.action.findMany({
      where: {
        userId: ctx.user.id,
        tbd: new Date(date),
        projectId: { not: null },
      },
      include: { project: true },
    })
  ),
  standaloneActions: requireAuth((_, { date }: any, ctx) =>
    ctx.prisma.action.findMany({
      where: {
        userId: ctx.user.id,
        tbd: new Date(date),
        projectId: null,
      },
    })
  ),
  dayState: requireAuth((_, { date }: any, ctx) =>
    ctx.prisma.dayState.findUnique({
      where: {
        userId_dateKey: { userId: ctx.user.id, dateKey: date },
      },
    })
  ),
  todayActions: requireAuth((_, { date }: any, ctx) =>
    getTodayActions(ctx.prisma, ctx.user.id, date)
  ),
  preDayStatus: requireAuth((_, { date }: any, ctx) =>
    getPreDayStatus(ctx.prisma, ctx.user.id, date)
  ),
  notDoneActionsForDate: requireAuth((_, { date }: any, ctx) =>
    getNotDoneActionsForDate(ctx.prisma, ctx.user.id, date)
  ),
  me: requireAuth((_, __, ctx) =>
    ctx.prisma.user.findUnique({ where: { id: ctx.user.id } })
  ),
  notes: requireAuth((_, { entityType, entityId }: any, ctx) =>
    ctx.prisma.note.findMany({
      where: { entityType, entityId, userId: ctx.user.id },
      orderBy: { createdAt: "asc" },
    })
  ),
  onboardingProgress: requireAuth((_, __, ctx) =>
    ctx.prisma.onboardingProgress.findUnique({ where: { userId: ctx.user.id } })
  ),
  moduleIntroViewed: requireAuth(async (_, { moduleKey }: any, ctx) => {
    const record = await ctx.prisma.moduleIntroViewed.findUnique({
      where: { userId_moduleKey: { userId: ctx.user.id, moduleKey } },
    });
    return !!record;
  }),
};
