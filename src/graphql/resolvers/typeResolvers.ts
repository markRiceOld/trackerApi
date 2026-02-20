export const typeResolvers = {
  DayState: {
    afterDayCompletedAt: (parent: any) =>
      parent.afterDayCompletedAt != null ? new Date(parent.afterDayCompletedAt).toISOString() : null,
    actionGatheringCompletedAt: (parent: any) =>
      parent.actionGatheringCompletedAt != null
        ? new Date(parent.actionGatheringCompletedAt).toISOString()
        : null,
    preDayCompletedAt: (parent: any) =>
      parent.preDayCompletedAt != null
        ? new Date(parent.preDayCompletedAt).toISOString()
        : null,
  },

  ActionWithOverlap: {
    action: (parent: any) => parent.action,
    overlapIds: (parent: any) => parent.overlapIds ?? [],
  },

  Action: {
    tbd: (parent: any) =>
      parent.tbd != null ? new Date(parent.tbd).toISOString() : null,
    forDate: (parent: any) =>
      parent.forDate != null ? new Date(parent.forDate).toISOString().slice(0, 10) : null,
    createdAt: (parent: any) =>
      parent.createdAt != null ? new Date(parent.createdAt).toISOString() : null,
  },

  Project: {
    startDate: (parent: any) => {
      const actions = parent.actions ?? [];
      const tbdDates = actions.map((a: any) => a.tbd).filter(Boolean);
      if (!tbdDates.length) return null;
      return new Date(
        Math.min(...tbdDates.map((d: any) => new Date(d).getTime()))
      ).toISOString();
    },
    endDate: (parent: any) => {
      const actions = parent.actions ?? [];
      const tbdDates = actions.map((a: any) => a.tbd).filter(Boolean);
      if (!tbdDates.length) return null;
      return new Date(
        Math.max(...tbdDates.map((d: any) => new Date(d).getTime()))
      ).toISOString();
    },
    actions: async (parent: any, _: any, ctx: any) => {
      if (parent.actions != null) return parent.actions;
      const actions = await ctx.prisma.action.findMany({
        where: { projectId: parent.id },
      });
      return actions ?? [];
    },
    milestone: (parent: any, _: any, ctx: any) =>
      parent.milestoneId
        ? ctx.prisma.milestone.findUnique({
            where: { id: parent.milestoneId },
          })
        : null,
    intervals: async (parent: any, _: any, ctx: any) => {
      if (parent.intervals != null) return parent.intervals;
      return ctx.prisma.interval.findMany({
        where: { projectId: parent.id },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    },
  },

  Goal: {
    startDate: (parent: any) => {
      const projects = parent.projects ?? [];
      const dates = projects.flatMap(
        (p: any) => p.actions?.map((a: any) => a.tbd).filter(Boolean) ?? []
      );
      if (!dates.length) return null;
      return new Date(
        Math.min(...dates.map((d: any) => new Date(d).getTime()))
      ).toISOString();
    },
    endDate: (parent: any) => {
      const projects = parent.projects ?? [];
      const dates = projects.flatMap(
        (p: any) => p.actions?.map((a: any) => a.tbd).filter(Boolean) ?? []
      );
      if (!dates.length) return null;
      return new Date(
        Math.max(...dates.map((d: any) => new Date(d).getTime()))
      ).toISOString();
    },
    intervals: async (parent: any, _: any, ctx: any) => {
      if (parent.intervals != null) return parent.intervals;
      return ctx.prisma.interval.findMany({
        where: { goalId: parent.id },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    },
    childGoals: async (parent: any, _: any, ctx: any) => {
      if (parent.childGoals != null) return parent.childGoals;
      return ctx.prisma.goal.findMany({
        where: { parentGoalId: parent.id },
        orderBy: { createdAt: "asc" },
      });
    },
    parentGoal: async (parent: any, _: any, ctx: any) => {
      if (parent.parentGoalId == null) return null;
      if (parent.parentGoal != null) return parent.parentGoal;
      return ctx.prisma.goal.findUnique({ where: { id: parent.parentGoalId } });
    },
    parentMilestone: async (parent: any, _: any, ctx: any) => {
      if (parent.parentMilestoneId == null) return null;
      if (parent.parentMilestone != null) return parent.parentMilestone;
      return ctx.prisma.milestone.findUnique({ where: { id: parent.parentMilestoneId } });
    },
  },

  Milestone: {
    childGoals: async (parent: any, _: any, ctx: any) => {
      if (parent.childGoals != null) return parent.childGoals;
      return ctx.prisma.goal.findMany({
        where: { parentMilestoneId: parent.id },
        orderBy: { createdAt: "asc" },
      });
    },
    predictionDate: (parent: any) =>
      parent.predictionDate != null
        ? new Date(parent.predictionDate).toISOString()
        : null,
    intervals: async (parent: any, _: any, ctx: any) => {
      if (parent.intervals != null) return parent.intervals;
      return ctx.prisma.interval.findMany({
        where: { milestoneId: parent.id },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    },
  },

  Interval: {
    estimatedTimeMinutes: (parent: any) => parent.estimatedTimeMinutes ?? 0,
    endTime: (parent: any) =>
      parent.endTime != null ? new Date(parent.endTime).toISOString() : null,
    customRepeatDates: (parent: any) => {
      if (parent.customRepeatDates == null || parent.customRepeatDates === "") return [];
      try {
        const arr = JSON.parse(parent.customRepeatDates);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    },
    createdAt: (parent: any) => new Date(parent.createdAt).toISOString(),
    updatedAt: (parent: any) => new Date(parent.updatedAt).toISOString(),
    goal: (parent: any, _: any, ctx: any) =>
      parent.goalId
        ? parent.goal ?? ctx.prisma.goal.findUnique({ where: { id: parent.goalId } })
        : null,
    milestone: (parent: any, _: any, ctx: any) =>
      parent.milestoneId
        ? parent.milestone ??
          ctx.prisma.milestone.findUnique({ where: { id: parent.milestoneId } })
        : null,
    project: (parent: any, _: any, ctx: any) =>
      parent.projectId
        ? parent.project ??
          ctx.prisma.project.findUnique({ where: { id: parent.projectId } })
        : null,
  },

  IntervalStep: {
    createdAt: (parent: any) => new Date(parent.createdAt).toISOString(),
  },

  Routine: {
    estimatedTimeMinutes: (parent: any) => parent.estimatedTimeMinutes ?? 0,
    endTime: (parent: any) =>
      parent.endTime != null ? new Date(parent.endTime).toISOString() : null,
    timeOfDayBlocks: (parent: any) => {
      if (parent.timeOfDayBlocks == null || parent.timeOfDayBlocks === "") return [];
      try {
        const arr = JSON.parse(parent.timeOfDayBlocks);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    },
    createdAt: (parent: any) => new Date(parent.createdAt).toISOString(),
    updatedAt: (parent: any) => new Date(parent.updatedAt).toISOString(),
  },

  RoutineStep: {
    createdAt: (parent: any) => new Date(parent.createdAt).toISOString(),
  },

  User: {
    intervals: async (parent: any, _: any, ctx: any) => {
      if (parent.intervals != null) return parent.intervals;
      return ctx.prisma.interval.findMany({
        where: { userId: parent.id },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    },
    routines: async (parent: any, _: any, ctx: any) => {
      if (parent.routines != null) return parent.routines;
      return ctx.prisma.routine.findMany({
        where: { userId: parent.id },
        include: { steps: { orderBy: { order: "asc" } } },
      });
    },
  },
};
