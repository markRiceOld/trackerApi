import { gql } from "apollo-server-express";

export const typeDefs = gql`
  type Action {
    id: ID!
    title: String!
    tbd: String
    done: Boolean!
    createdAt: String!
    project: Project
  }

  type Project {
    id: ID!
    title: String!
    dod: String
    type: String!
    actions: [Action!]!
    startDate: String
    endDate: String
  }

  type Habit {
    id: ID!
    title: String!
    goals: [Goal!]!
  }
  
  type Goal {
    id: ID!
    title: String!
    dod: String
    habitId: ID
    habit: Habit
    startDate: String
    endDate: String
    createdAt: String!
    milestones: [Milestone!]!
    projects: [Project!]!
  }
  
  type Milestone {
    id: ID!
    title: String!
    goalId: ID!
    goal: Goal!
    projects: [Project!]!
  }

  type Query {
    actions: [Action!]!
    action(id: ID!): Action
    projects: [Project!]!
    project(id: ID!): Project
    goals: [Goal!]!
    goal(id: ID!): Goal
    linkedActions(date: String!): [Action!]!
    standaloneActions(date: String!): [Action!]!
  }

  input ActionInput {
    title: String!
    tbd: String
  }

  type Mutation {
    addAction(title: String!, tbd: String, projectId: String): Action!
    updateAction(id: ID!, title: String, tbd: String, done: Boolean): Action!
    deleteAction(id: ID!): Action!

    addProject(
      title: String!
      dod: String
      type: String
      goalId: ID
      milestoneId: ID
      actions: [ActionInput!]
    ): Project!
    updateProject(
      id: ID!
      title: String
      dod: String
      type: String
      goalId: ID
      milestoneId: ID
    ): Project!
    deleteProject(id: ID!): Project!

    addGoal(title: String!, dod: String, habitId: ID): Goal!
    updateGoal(id: ID!, title: String, dod: String, habitId: ID, startDate: String, endDate: String): Goal!
    deleteGoal(id: ID!): Goal!

    toggleAction(id: ID!): Action!
  }
`;

export const resolvers = {
  Query: {
    actions: (_: any, __: any, ctx: any) => {
      return ctx.prisma.action.findMany({ orderBy: { createdAt: "desc" } });
    },
    action: (_: any, { id }: any, ctx: any) => {
      return ctx.prisma.action.findUnique({ where: { id } });
    },
    projects: (_: any, __: any, ctx: any) => {
      return ctx.prisma.project.findMany({
        include: { actions: true },
        orderBy: { createdAt: "desc" },
      });
    },
    project: (_: any, { id }: any, ctx: any) => {
      return ctx.prisma.project.findUnique({
        where: { id },
        include: { actions: true },
      });
    },
    goals: (_: any, __: any, ctx: any) => {
      return ctx.prisma.goal.findMany({
        include: {
          milestones: { include: { projects: true } },
          habit: true,
          projects: { include: { actions: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    },
    goal: (_: any, args: any, ctx: any) => {
      return ctx.prisma.goal.findUnique({
        where: { id: args.id },
        include: {
          milestones: { include: { projects: true } },
          habit: true,
          projects: true,
        },
      });
    },
    linkedActions: async (_: any, { date }: { date: string }, ctx: any) => {
      return ctx.prisma.action.findMany({
        where: {
          tbd: new Date(date),
          projectId: { not: null },
        },
        include: {
          project: true,
        },
      });
    },
    standaloneActions: async (_: any, { date }: { date: string }, ctx: any) => {
      return ctx.prisma.action.findMany({
        where: {
          tbd: new Date(date),
          projectId: null,
        },
      });
    },
  },
  Mutation: {
    addAction: (_: any, { title, tbd, projectId }: any, ctx: any) => {
      return ctx.prisma.action.create({
        data: {
          title,
          tbd: tbd ? new Date(tbd) : undefined,
          projectId,
        },
      });
    },
    updateAction: (_: any, { id, title, tbd, done }: any, ctx: any) => {
      return ctx.prisma.action.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(tbd !== undefined && { tbd: new Date(tbd) }),
          ...(done !== undefined && { done }),
        },
      });
    },
    deleteAction: (_: any, { id }: any, ctx: any) => {
      return ctx.prisma.action.delete({ where: { id } });
    },

    addProject: async (_: any, { title, dod, type, actions, goalId, milestoneId }: any, ctx: any) => {
      return ctx.prisma.project.create({
        data: {
          title,
          dod,
          type: type || "individual",
          goalId: goalId ?? undefined,
          milestoneId: milestoneId ?? undefined,
          actions: {
            create: actions?.map((a: any) => ({
              title: a.title,
              tbd: a.tbd ? new Date(a.tbd) : undefined,
            })) ?? [],
          },
        },
        include: { actions: true },
      });
    },
    updateProject: async (_: any, { id, title, dod, type, goalId, milestoneId }: any, ctx: any) => {
      return ctx.prisma.project.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(dod !== undefined && { dod }),
          ...(type !== undefined && { type }),
          ...(goalId !== undefined && { goalId }),
          ...(milestoneId !== undefined && { milestoneId }),
        },
        include: { actions: true },
      });
    },
    deleteProject: (_: any, { id }: any, ctx: any) => {
      return ctx.prisma.project.delete({ where: { id } });
    },

    addGoal: (_: any, args: any, ctx: any) => {
      return ctx.prisma.goal.create({
        data: {
          title: args.title,
          dod: args.dod,
          habitId: args.habitId ?? undefined,
        },
      });
    },
    updateGoal: (_: any, args: any, ctx: any) => {
      return ctx.prisma.goal.update({
        where: { id: args.id },
        data: {
          title: args.title,
          dod: args.dod,
          habitId: args.habitId ?? undefined,
          startDate: args.startDate ? new Date(args.startDate) : undefined,
          endDate: args.endDate ? new Date(args.endDate) : undefined,
        },
      });
    },
    deleteGoal: (_: any, args: any, ctx: any) => {
      return ctx.prisma.goal.delete({ where: { id: args.id } });
    },

    toggleAction: async (_: any, { id }: any, ctx: any) => {
      const current = await ctx.prisma.action.findUnique({ where: { id } });
      return ctx.prisma.action.update({
        where: { id },
        data: { done: !current.done },
      });
    },
  },
  Project: {
    startDate: (parent: any) => {
      const actions = parent.actions ?? [];
      const tbdDates = actions.map((a: any) => a.tbd).filter(Boolean);
      if (!tbdDates.length) return null;
  
      return new Date(Math.min(...tbdDates.map((d: any) => new Date(d).getTime()))).toISOString();
    },
    endDate: (parent: any) => {
      const actions = parent.actions ?? [];
      const tbdDates = actions.map((a: any) => a.tbd).filter(Boolean);
      if (!tbdDates.length) return null;
  
      return new Date(Math.max(...tbdDates.map((d: any) => new Date(d).getTime()))).toISOString();
    }
  },
  Goal: {
    startDate: (parent: any) => {
      const projects = parent.projects ?? [];
      const dates = projects
        .flatMap((p: any) => p.actions?.map((a: any) => a.tbd).filter(Boolean) ?? []);
  
      if (!dates.length) return null;
      return new Date(Math.min(...dates.map((d: any) => new Date(d).getTime()))).toISOString();
    },
    endDate: (parent: any) => {
      const projects = parent.projects ?? [];
      const dates = projects
        .flatMap((p: any) => p.actions?.map((a: any) => a.tbd).filter(Boolean) ?? []);
  
      if (!dates.length) return null;
      return new Date(Math.max(...dates.map((d: any) => new Date(d).getTime()))).toISOString();
    },
  },  
};
