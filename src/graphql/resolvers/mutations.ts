import bcrypt from "bcrypt";
import { ensureOwned, requireAuth, signToken, SALT_ROUNDS } from "../auth";
import { runActionGathering } from "../../services/actionGathering";

const MAX_ESTIMATED_MINUTES = 24 * 60; // 24 hours

/** Normalize to array of "HH:mm" strings for timeOfDayBlocks. */
function normalizeTimeOfDayBlocks(blocks: string[] | null | undefined): string[] {
  if (blocks == null || blocks.length === 0) return [];
  return blocks.map((s) => String(s).trim().slice(0, 5)).filter((s) => /^\d{2}:\d{2}$/.test(s));
}

function validateEstimatedMinutes(value: number | null | undefined, required: boolean, label: string): number | undefined {
  if (value == null) {
    if (required) throw new Error(`${label} estimatedTimeMinutes is required.`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_ESTIMATED_MINUTES) {
    throw new Error(`${label} estimatedTimeMinutes must be between 0 and ${MAX_ESTIMATED_MINUTES} (24 hours).`);
  }
  return n;
}

const mutations: Record<string, any> = {};

// ---- Actions ----
mutations.addAction = requireAuth(async (_, { title, tbd, projectId, priority, estimatedTimeMinutes, startTimeOfDay }: any, ctx) => {
  if (projectId) {
    const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
    ensureOwned(project, ctx);
  }
  const hasDueDate = Boolean(tbd);
  const est = validateEstimatedMinutes(estimatedTimeMinutes, hasDueDate, "Action");
  return ctx.prisma.action.create({
    data: {
      title,
      tbd: tbd ? new Date(tbd) : undefined,
      projectId,
      priority: priority ?? "P",
      estimatedTimeMinutes: est,
      startTimeOfDay: startTimeOfDay ?? undefined,
      userId: ctx.user.id,
    },
  });
});
mutations.updateAction = requireAuth(async (_, { id, title, tbd, done, priority, estimatedTimeMinutes, startTimeOfDay, actionFate, projectId }: any, ctx) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  if (projectId != null) {
    const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
    ensureOwned(project, ctx);
  }
  const effectiveTbd = tbd !== undefined ? (tbd ? new Date(tbd) : null) : existing!.tbd;
  const hasDueDate = Boolean(effectiveTbd);
  const est =
    estimatedTimeMinutes !== undefined
      ? validateEstimatedMinutes(estimatedTimeMinutes, hasDueDate, "Action")
      : undefined;
  return ctx.prisma.action.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(tbd !== undefined && { tbd: tbd ? new Date(tbd) : null }),
      ...(done !== undefined && { done }),
      ...(priority !== undefined && { priority }),
      ...(est !== undefined && { estimatedTimeMinutes: est }),
      ...(startTimeOfDay !== undefined && { startTimeOfDay: startTimeOfDay || null }),
      ...(actionFate !== undefined && { actionFate: actionFate ?? null }),
      ...(projectId !== undefined && { projectId: projectId ?? null }),
    },
  });
});
mutations.deleteAction = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.delete({ where: { id } });
});

// ---- Projects ----
mutations.addProject = requireAuth(
  async (_, { title, dod, type, actions, goalId, milestoneId, priority }: any, ctx) => {
    if (goalId != null && milestoneId != null) {
      throw new Error("Cannot set both goalId and milestoneId; use one or the other.");
    }
    if (goalId) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    return ctx.prisma.project.create({
      data: {
        title,
        dod,
        type: type || "individual",
        goalId: goalId ?? undefined,
        milestoneId: milestoneId ?? undefined,
        priority: priority ?? "P",
        userId: ctx.user.id,
        actions: {
          create:
            actions?.map((a: any) => {
              const hasDueDate = Boolean(a.tbd);
              const est = validateEstimatedMinutes(a.estimatedTimeMinutes, hasDueDate, "Action");
              return {
                title: a.title,
                tbd: a.tbd ? new Date(a.tbd) : undefined,
                priority: a.priority ?? "P",
                estimatedTimeMinutes: est,
                userId: ctx.user.id,
              };
            }) ?? [],
        },
      },
      include: { actions: true },
    });
  }
);
mutations.updateProject = requireAuth(
  async (_, { id, title, dod, type, goalId, milestoneId, priority }: any, ctx) => {
    if (goalId !== undefined && milestoneId !== undefined && goalId != null && milestoneId != null) {
      throw new Error("Cannot set both goalId and milestoneId; use one or the other.");
    }
    const existing = await ctx.prisma.project.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    if (goalId !== undefined && goalId != null) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId !== undefined && milestoneId != null) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    return ctx.prisma.project.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(dod !== undefined && { dod }),
        ...(type !== undefined && { type }),
        ...(goalId !== undefined && { goalId }),
        ...(milestoneId !== undefined && { milestoneId }),
        ...(priority !== undefined && { priority }),
      },
      include: { actions: true },
    });
  }
);
mutations.deleteProject = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.project.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.project.delete({ where: { id } });
});

// ---- Goals ----
mutations.addGoal = requireAuth(async (_, args: any, ctx) => {
  if (args.parentGoalId != null && args.parentMilestoneId != null) {
    throw new Error("A goal cannot have both a parent goal and a parent milestone.");
  }
  if (args.parentGoalId != null) {
    const parent = await ctx.prisma.goal.findUnique({ where: { id: args.parentGoalId } });
    ensureOwned(parent, ctx);
  }
  if (args.parentMilestoneId != null) {
    const milestone = await ctx.prisma.milestone.findUnique({
      where: { id: args.parentMilestoneId },
      include: { goal: true },
    });
    ensureOwned(milestone?.goal ?? null, ctx);
  }
  return ctx.prisma.goal.create({
    data: {
      title: args.title,
      dod: args.dod,
      isGoalGroup: args.isGoalGroup === true,
      parentGoalId: args.parentGoalId ?? undefined,
      parentMilestoneId: args.parentMilestoneId ?? undefined,
      userId: ctx.user.id,
    },
  });
});
mutations.updateGoal = requireAuth(async (_, args: any, ctx) => {
  const existing = await ctx.prisma.goal.findUnique({ where: { id: args.id } });
  ensureOwned(existing, ctx);
  if (args.parentGoalId !== undefined && args.parentMilestoneId !== undefined && args.parentGoalId != null && args.parentMilestoneId != null) {
    throw new Error("A goal cannot have both a parent goal and a parent milestone.");
  }
  if (args.parentGoalId != null) {
    const parent = await ctx.prisma.goal.findUnique({ where: { id: args.parentGoalId } });
    ensureOwned(parent, ctx);
  }
  if (args.parentMilestoneId != null) {
    const milestone = await ctx.prisma.milestone.findUnique({
      where: { id: args.parentMilestoneId },
      include: { goal: true },
    });
    ensureOwned(milestone?.goal ?? null, ctx);
  }
  const data: any = {
    ...(args.title !== undefined && { title: args.title }),
    ...(args.dod !== undefined && { dod: args.dod }),
    ...(args.isGoalGroup !== undefined && { isGoalGroup: args.isGoalGroup }),
    ...(args.startDate !== undefined && { startDate: args.startDate ? new Date(args.startDate) : null }),
    ...(args.endDate !== undefined && { endDate: args.endDate ? new Date(args.endDate) : null }),
  };
  if (args.parentGoalId !== undefined) {
    data.parentGoalId = args.parentGoalId ?? null;
    data.parentMilestoneId = null;
  }
  if (args.parentMilestoneId !== undefined) {
    data.parentMilestoneId = args.parentMilestoneId ?? null;
    data.parentGoalId = null;
  }
  return ctx.prisma.goal.update({
    where: { id: args.id },
    data,
  });
});
mutations.deleteGoal = requireAuth(async (_, args: any, ctx) => {
  const existing = await ctx.prisma.goal.findUnique({ where: { id: args.id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.goal.delete({ where: { id: args.id } });
});

// ---- Milestones ----
mutations.addMilestone = requireAuth(async (_, { goalId, title, doa, predictionDate, isLast: wantLast }: any, ctx) => {
  const goal = await ctx.prisma.goal.findUnique({
    where: { id: goalId },
    include: {
      milestones: { orderBy: [{ isLast: "asc" }, { order: "asc" }] },
    },
  });
  ensureOwned(goal, ctx);
  const milestones = goal!.milestones;
  if (wantLast === true) {
    await ctx.prisma.milestone.updateMany({
      where: { goalId },
      data: { isLast: false },
    });
  }
  const lastMilestone = milestones.find((m: any) => m.isLast);
  let newOrder: number;
  if (lastMilestone && !wantLast) {
    newOrder = lastMilestone.order;
    await ctx.prisma.milestone.updateMany({
      where: { goalId, order: { gte: lastMilestone.order } },
      data: { order: { increment: 1 } },
    });
  } else {
    const maxOrder = milestones.length
      ? Math.max(...milestones.map((m: any) => m.order))
      : -1;
    newOrder = maxOrder + 1;
  }
  return ctx.prisma.milestone.create({
    data: {
      goalId,
      title,
      doa: doa ?? undefined,
      predictionDate: predictionDate ? new Date(predictionDate) : undefined,
      order: newOrder,
      isLast: wantLast === true,
    },
  });
});
mutations.updateMilestone = requireAuth(async (_, { id, title, doa, predictionDate, order, isLast, goalId: newGoalId }: any, ctx) => {
  const existing = await ctx.prisma.milestone.findUnique({
    where: { id },
    include: { goal: true },
  });
  ensureOwned(existing?.goal ?? null, ctx);
  if (newGoalId !== undefined && newGoalId != null) {
    const newGoal = await ctx.prisma.goal.findUnique({ where: { id: newGoalId } });
    ensureOwned(newGoal, ctx);
    const newGoalMilestones = await ctx.prisma.milestone.findMany({
      where: { goalId: newGoalId },
      orderBy: [{ isLast: "asc" }, { order: "asc" }],
    });
    const maxOrder = newGoalMilestones.length ? Math.max(...newGoalMilestones.map((m: any) => m.order)) : -1;
    await ctx.prisma.milestone.update({
      where: { id },
      data: { goalId: newGoalId, order: maxOrder + 1, isLast: false },
    });
    return ctx.prisma.milestone.findUniqueOrThrow({ where: { id } });
  }
  if (isLast === true) {
    await ctx.prisma.milestone.updateMany({
      where: { goalId: existing!.goalId, id: { not: id } },
      data: { isLast: false },
    });
  }
  return ctx.prisma.milestone.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(doa !== undefined && { doa }),
      ...(predictionDate !== undefined && {
        predictionDate: predictionDate ? new Date(predictionDate) : null,
      }),
      ...(order !== undefined && { order }),
      ...(isLast !== undefined && { isLast }),
    },
  });
});
mutations.deleteMilestone = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.milestone.findUnique({
    where: { id },
    include: { goal: true },
  });
  ensureOwned(existing?.goal ?? null, ctx);
  return ctx.prisma.milestone.delete({ where: { id } });
});

// ---- Intervals ----
function atMostOneScope(goalId: string | null, milestoneId: string | null, projectId: string | null) {
  const set = [goalId, milestoneId, projectId].filter((x) => x != null);
  if (set.length > 1) {
    throw new Error("Interval can be linked to at most one of goal, milestone, or project.");
  }
}

mutations.addInterval = requireAuth(
  async (
    _,
    {
      title,
      estimatedTimeMinutes,
      status,
      endTime,
      repeatValue,
      repeatUnit,
      customRepeatDates,
      customRepeatRule,
      predictedToDoTime,
      steps,
      goalId,
      milestoneId,
      projectId,
    }: any,
    ctx
  ) => {
    const est = validateEstimatedMinutes(estimatedTimeMinutes, true, "Interval");
    atMostOneScope(goalId ?? null, milestoneId ?? null, projectId ?? null);
    const toDoTime = predictedToDoTime != null ? String(predictedToDoTime).trim().slice(0, 5) : null;
    if (toDoTime !== null && toDoTime !== "" && !/^\d{2}:\d{2}$/.test(toDoTime)) {
      throw new Error("predictedToDoTime must be HH:mm");
    }
    if (goalId) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    if (projectId) {
      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      ensureOwned(project, ctx);
    }
    return ctx.prisma.interval.create({
      data: {
        title,
        estimatedTimeMinutes: est!,
        status: status ?? "active",
        endTime: endTime ? new Date(endTime) : undefined,
        repeatValue: repeatValue ?? 1,
        repeatUnit: repeatUnit ?? undefined,
        customRepeatDates:
          customRepeatDates != null && customRepeatDates.length > 0
            ? JSON.stringify(customRepeatDates)
            : undefined,
        customRepeatRule: customRepeatRule ?? undefined,
        predictedToDoTime: toDoTime && /^\d{2}:\d{2}$/.test(toDoTime) ? toDoTime : undefined,
        goalId: goalId ?? undefined,
        milestoneId: milestoneId ?? undefined,
        projectId: projectId ?? undefined,
        userId: ctx.user.id,
        steps: {
          create:
            steps?.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })) ?? [],
        },
      },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
    });
  }
);

mutations.updateInterval = requireAuth(
  async (
    _,
    {
      id,
      title,
      estimatedTimeMinutes,
      status,
      endTime,
      repeatValue,
      repeatUnit,
      customRepeatDates,
      customRepeatRule,
      predictedToDoTime,
      steps,
      goalId,
      milestoneId,
      projectId,
    }: any,
    ctx
  ) => {
    const existing = await ctx.prisma.interval.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    const toDoTime =
      predictedToDoTime !== undefined
        ? (predictedToDoTime != null ? String(predictedToDoTime).trim().slice(0, 5) : null)
        : undefined;
    if (toDoTime !== undefined && toDoTime !== null && toDoTime !== "" && !/^\d{2}:\d{2}$/.test(toDoTime)) {
      throw new Error("predictedToDoTime must be HH:mm");
    }
    const est =
      estimatedTimeMinutes !== undefined
        ? validateEstimatedMinutes(estimatedTimeMinutes, false, "Interval")
        : undefined;
    atMostOneScope(
      goalId !== undefined ? goalId : existing!.goalId,
      milestoneId !== undefined ? milestoneId : existing!.milestoneId,
      projectId !== undefined ? projectId : existing!.projectId
    );
    if (goalId !== undefined && goalId != null) {
      const goal = await ctx.prisma.goal.findUnique({ where: { id: goalId } });
      ensureOwned(goal, ctx);
    }
    if (milestoneId !== undefined && milestoneId != null) {
      const milestone = await ctx.prisma.milestone.findUnique({
        where: { id: milestoneId },
        include: { goal: true },
      });
      ensureOwned(milestone?.goal ?? null, ctx);
    }
    if (projectId !== undefined && projectId != null) {
      const project = await ctx.prisma.project.findUnique({ where: { id: projectId } });
      ensureOwned(project, ctx);
    }
    const stepsPayload =
      steps !== undefined
        ? {
            deleteMany: {},
            create: steps.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })),
          }
        : undefined;
    return ctx.prisma.interval.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(est !== undefined && { estimatedTimeMinutes: est }),
        ...(status !== undefined && { status }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(repeatValue !== undefined && { repeatValue }),
        ...(repeatUnit !== undefined && { repeatUnit }),
        ...(customRepeatDates !== undefined && {
          customRepeatDates:
            customRepeatDates != null && customRepeatDates.length > 0
              ? JSON.stringify(customRepeatDates)
              : null,
        }),
        ...(customRepeatRule !== undefined && { customRepeatRule: customRepeatRule ?? null }),
        ...(toDoTime !== undefined && { predictedToDoTime: toDoTime }),
        ...(stepsPayload && { steps: stepsPayload }),
        ...(goalId !== undefined && { goalId: goalId ?? null }),
        ...(milestoneId !== undefined && { milestoneId: milestoneId ?? null }),
        ...(projectId !== undefined && { projectId: projectId ?? null }),
      },
      include: { steps: { orderBy: { order: "asc" } }, goal: true, milestone: true, project: true },
    });
  }
);

mutations.deleteInterval = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.interval.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.interval.delete({
    where: { id },
    include: { steps: true, goal: true, milestone: true, project: true },
  });
});

// ---- Routines (no link to goal/milestone/project) ----
mutations.addRoutine = requireAuth(
  async (_, { title, estimatedTimeMinutes, status, endTime, timeOfDayBlocks, timerDurationMinutes, steps }: any, ctx) => {
    const est = validateEstimatedMinutes(estimatedTimeMinutes, true, "Routine");
    const blocks = normalizeTimeOfDayBlocks(timeOfDayBlocks);
    return ctx.prisma.routine.create({
      data: {
        title,
        estimatedTimeMinutes: est!,
        status: status ?? "active",
        endTime: endTime ? new Date(endTime) : undefined,
        timeOfDayBlocks: blocks.length > 0 ? JSON.stringify(blocks) : undefined,
        timerDurationMinutes: timerDurationMinutes ?? undefined,
        userId: ctx.user.id,
        steps: {
          create:
            steps?.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })) ?? [],
        },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }
);

mutations.updateRoutine = requireAuth(
  async (_, { id, title, estimatedTimeMinutes, status, endTime, timeOfDayBlocks, timerDurationMinutes, steps }: any, ctx) => {
    const existing = await ctx.prisma.routine.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    const est =
      estimatedTimeMinutes !== undefined
        ? validateEstimatedMinutes(estimatedTimeMinutes, false, "Routine")
        : undefined;
    const blocks = timeOfDayBlocks !== undefined ? normalizeTimeOfDayBlocks(timeOfDayBlocks) : undefined;
    const stepsPayload =
      steps !== undefined
        ? {
            deleteMany: {},
            create: steps.map((s: any, i: number) => ({
              title: s.title,
              order: s.order ?? i,
            })),
          }
        : undefined;
    return ctx.prisma.routine.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(est !== undefined && { estimatedTimeMinutes: est }),
        ...(status !== undefined && { status }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(blocks !== undefined && { timeOfDayBlocks: blocks.length > 0 ? JSON.stringify(blocks) : null }),
        ...(timerDurationMinutes !== undefined && { timerDurationMinutes }),
        ...(stepsPayload && { steps: stepsPayload }),
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  }
);

mutations.deleteRoutine = requireAuth(async (_, { id }: any, ctx) => {
  const existing = await ctx.prisma.routine.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.routine.delete({
    where: { id },
    include: { steps: true },
  });
});

mutations.toggleAction = requireAuth(async (_, { id }: any, ctx) => {
  const current = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(current, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { done: !current!.done },
  });
});

// ---- Auth ----
mutations.register = async (_: any, { email, password }: any, ctx: any) => {
  const existing = await ctx.prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Email already in use");
  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await ctx.prisma.user.create({
    data: { email, password: hashed },
  });
  const token = signToken(user);
  return { token, user };
};
mutations.login = async (_: any, { email, password }: any, ctx: any) => {
  const user = await ctx.prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("User not found");
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error("Incorrect password");
  const token = signToken(user);
  return { token, user };
};

mutations.runActionGathering = requireAuth(async (_: any, { todayDate }: { todayDate: string }, ctx: any) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayDate)) {
    throw new Error("todayDate must be YYYY-MM-DD");
  }
  return runActionGathering(ctx.prisma, ctx.user.id, {
    todayDateKey: todayDate,
    skipCompletedDates: true,
  });
});

// ---- Pre-day / After-day ----
function validateDateKey(dateKey: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

mutations.setActionStartTime = requireAuth(async (_: any, { id, startTimeOfDay }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  const trimmed = String(startTimeOfDay).trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(trimmed)) throw new Error("startTimeOfDay must be HH:mm");
  return ctx.prisma.action.update({
    where: { id },
    data: { startTimeOfDay: trimmed },
  });
});

mutations.postponeAction = requireAuth(async (_: any, { id, newDate }: any, ctx: any) => {
  validateDateKey(newDate, "newDate");
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  const forDate = new Date(newDate + "T00:00:00.000Z");
  return ctx.prisma.action.update({
    where: { id },
    data: {
      ...(existing!.isGathered ? { forDate } : { tbd: forDate }),
      actionFate: "Postponed",
    },
  });
});

mutations.outsourceAction = requireAuth(
  async (
    _: any,
    {
      id,
      doOutsourcingTitle,
      doOutsourcingDate,
      ensureDoneTitle,
      ensureDoneDate,
    }: any,
    ctx: any
  ) => {
    validateDateKey(doOutsourcingDate, "doOutsourcingDate");
    validateDateKey(ensureDoneDate, "ensureDoneDate");
    const existing = await ctx.prisma.action.findUnique({ where: { id } });
    ensureOwned(existing, ctx);
    const userId = ctx.user.id;
    await ctx.prisma.action.createMany({
      data: [
        {
          userId,
          title: doOutsourcingTitle,
          tbd: new Date(doOutsourcingDate + "T00:00:00.000Z"),
          priority: "P",
        },
        {
          userId,
          title: ensureDoneTitle,
          tbd: new Date(ensureDoneDate + "T00:00:00.000Z"),
          priority: "P",
        },
      ],
    });
    return ctx.prisma.action.update({
      where: { id },
      data: { actionFate: "OutsourceWoo" },
    });
  }
);

mutations.setActionNotImportant = requireAuth(async (_: any, { id }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { actionFate: "Backlog" },
  });
});

mutations.setActionIgnore = requireAuth(async (_: any, { id }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { actionFate: "BucketList" },
  });
});

mutations.setActionPassedArchived = requireAuth(async (_: any, { id }: any, ctx: any) => {
  const existing = await ctx.prisma.action.findUnique({ where: { id } });
  ensureOwned(existing, ctx);
  return ctx.prisma.action.update({
    where: { id },
    data: { actionFate: "PassedArchived" },
  });
});

mutations.completeAfterDay = requireAuth(async (_: any, { date }: any, ctx: any) => {
  validateDateKey(date, "date");
  return ctx.prisma.dayState.upsert({
    where: { userId_dateKey: { userId: ctx.user.id, dateKey: date } },
    create: {
      userId: ctx.user.id,
      dateKey: date,
      afterDayCompletedAt: new Date(),
    },
    update: { afterDayCompletedAt: new Date() },
  });
});

mutations.completePreDay = requireAuth(async (_: any, { date }: any, ctx: any) => {
  validateDateKey(date, "date");
  return ctx.prisma.dayState.upsert({
    where: { userId_dateKey: { userId: ctx.user.id, dateKey: date } },
    create: {
      userId: ctx.user.id,
      dateKey: date,
      preDayCompletedAt: new Date(),
    },
    update: { preDayCompletedAt: new Date() },
  });
});

export const mutationResolvers = mutations;
