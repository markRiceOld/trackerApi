import { gql } from "apollo-server-express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

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
    goal: Goal
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

  type User {
    id: ID!
    email: String!
    name: String
    createdAt: String
    actions: [Action!]!
    projects: [Project!]!
    goals: [Goal!]!
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
    me: User
  }

  type AuthPayload {
    token: String!
    user: User!
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

    register(email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
  }
`;

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret"; // use env in real deployments
const SALT_ROUNDS = 10;

function signToken(user: { id: string }) {
  return jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
}

function requireAuth<TArgs>(
  resolver: (parent: any, args: TArgs, ctx: any) => any
) {
  return (parent: any, args: TArgs, ctx: any) => {
    if (!ctx.user) throw new Error("Unauthorized");
    return resolver(parent, args, ctx);
  };
}


export const resolvers = {
  Query: {
    actions: requireAuth((_, __, ctx) => ctx.prisma.action.findMany({ orderBy: { createdAt: "desc" } })),
    action: requireAuth((_, { id }: any, ctx) => ctx.prisma.action.findUnique({ where: { id } })),
    projects: requireAuth((_, __, ctx) => ctx.prisma.project.findMany({ include: { actions: true, goal: true }, orderBy: { createdAt: "desc" } })),
    project: requireAuth((_, { id }: any, ctx) => ctx.prisma.project.findUnique({ where: { id }, include: { actions: true, goal: true } })),
    goals: requireAuth((_, __, ctx) => ctx.prisma.goal.findMany({
      include: {
        milestones: { include: { projects: true } },
        habit: true,
        projects: { include: { actions: true } },
      },
      orderBy: { createdAt: "desc" },
    })),
    goal: requireAuth((_, args: any, ctx) => ctx.prisma.goal.findUnique({
      where: { id: args.id },
      include: {
        milestones: { include: { projects: true } },
        habit: true,
        projects: true,
      },
    })),
    linkedActions: requireAuth(async (_, { date }: any, ctx) => {
      return ctx.prisma.action.findMany({
        where: {
          tbd: new Date(date),
          projectId: { not: null },
        },
        include: {
          project: true,
        },
      });
    }),
    standaloneActions: requireAuth(async (_, { date }: any, ctx) => {
      return ctx.prisma.action.findMany({
        where: {
          tbd: new Date(date),
          projectId: null,
        },
      });
    }),
  },

  Mutation: {
    addAction: requireAuth((_, { title, tbd, projectId }: any, ctx) => {
      return ctx.prisma.action.create({
        data: {
          title,
          tbd: tbd ? new Date(tbd) : undefined,
          projectId,
          userId: ctx.user.id,
        },
      });
    }),
    updateAction: requireAuth((_, { id, title, tbd, done }: any, ctx) => {
      return ctx.prisma.action.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(tbd !== undefined && { tbd: new Date(tbd) }),
          ...(done !== undefined && { done }),
        },
      });
    }),
    deleteAction: requireAuth((_, { id }: any, ctx) => ctx.prisma.action.delete({ where: { id } })),

    addProject: requireAuth(async (_, { title, dod, type, actions, goalId, milestoneId }: any, ctx) => {
      return ctx.prisma.project.create({
        data: {
          title,
          dod,
          type: type || "individual",
          goalId: goalId ?? undefined,
          milestoneId: milestoneId ?? undefined,
          userId: ctx.user.id,
          actions: {
            create: actions?.map((a: any) => ({
              title: a.title,
              tbd: a.tbd ? new Date(a.tbd) : undefined,
            })) ?? [],
          },
        },
        include: { actions: true },
      });
    }),
    updateProject: requireAuth(async (_, { id, title, dod, type, goalId, milestoneId }: any, ctx) => {
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
    }),
    deleteProject: requireAuth((_, { id }: any, ctx) => ctx.prisma.project.delete({ where: { id } })),

    addGoal: requireAuth((_, args: any, ctx) => {
      return ctx.prisma.goal.create({
        data: {
          title: args.title,
          dod: args.dod,
          habitId: args.habitId ?? undefined,
          userId: ctx.user.id,
        },
      });
    }),
    updateGoal: requireAuth((_, args: any, ctx) => {
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
    }),
    deleteGoal: requireAuth((_, args: any, ctx) => ctx.prisma.goal.delete({ where: { id: args.id } })),

    toggleAction: requireAuth(async (_, { id }: any, ctx) => {
      const current = await ctx.prisma.action.findUnique({ where: { id } });
      return ctx.prisma.action.update({
        where: { id },
        data: { done: !current.done },
      });
    }),

    register: async (_: any, { email, password }: any, ctx: any) => {
      const existing = await ctx.prisma.user.findUnique({ where: { email } });
      if (existing) throw new Error("Email already in use");

      const hashed = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await ctx.prisma.user.create({
        data: { email, password: hashed },
      });
      const token = signToken(user);
      return { token, user };
    },

    login: async (_: any, { email, password }: any, ctx: any) => {
      const user = await ctx.prisma.user.findUnique({ where: { email } });
      if (!user) throw new Error("User not found");

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) throw new Error("Incorrect password");

      const token = signToken(user);
      return { token, user };
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
    },
    actions: async (parent: any, _: any, ctx: any) => {
      const actions = await ctx.prisma.action.findMany({
        where: { projectId: parent.id },
      });
      return actions ?? []; // ← Ensure it never returns null
    },
  },

  Goal: {
    startDate: (parent: any) => {
      const projects = parent.projects ?? [];
      const dates = projects.flatMap((p: any) => p.actions?.map((a: any) => a.tbd).filter(Boolean) ?? []);
      if (!dates.length) return null;
      return new Date(Math.min(...dates.map((d: any) => new Date(d).getTime()))).toISOString();
    },
    endDate: (parent: any) => {
      const projects = parent.projects ?? [];
      const dates = projects.flatMap((p: any) => p.actions?.map((a: any) => a.tbd).filter(Boolean) ?? []);
      if (!dates.length) return null;
      return new Date(Math.max(...dates.map((d: any) => new Date(d).getTime()))).toISOString();
    },
  },
};
