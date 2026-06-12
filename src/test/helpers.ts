import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

// Shared Prisma client for all tests — points to test.db via DATABASE_URL env var
export const prisma = new PrismaClient();

/** Delete all rows in dependency order (children before parents). */
export async function clearDb() {
  await prisma.note.deleteMany();
  await prisma.action.deleteMany();
  await prisma.dayState.deleteMany();
  await prisma.intervalStep.deleteMany();
  await prisma.interval.deleteMany();
  await prisma.routineStep.deleteMany();
  await prisma.routine.deleteMany();
  await prisma.project.deleteMany();
  // Goals self-reference via parentGoalId — clear children first by nulling the FK
  await prisma.goal.updateMany({ data: { parentGoalId: null, parentMilestoneId: null } });
  await prisma.milestone.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.user.deleteMany();
}

/** Create a user with a low-cost bcrypt hash (rounds=4 for speed). */
export async function createTestUser(overrides?: {
  email?: string;
  password?: string;
  name?: string;
}) {
  const rawPassword = overrides?.password ?? "password123";
  const hashed = await bcrypt.hash(rawPassword, 4);
  return prisma.user.create({
    data: {
      email: overrides?.email ?? "test@example.com",
      password: hashed,
      name: overrides?.name ?? "Test User",
    },
  });
}

/** Build a resolver context object for the given user. */
export function makeCtx(user: { id: string }) {
  return { user, prisma };
}
