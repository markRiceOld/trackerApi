import jwt from "jsonwebtoken";
import { env } from "process";

export const SALT_ROUNDS = 10;

const JWT_SECRET = () => env.JWT_SECRET ?? "dev-secret";

export function signToken(user: { id: string }) {
  return jwt.sign({ userId: user.id }, JWT_SECRET(), { expiresIn: "7d" });
}

export function requireAuth<TArgs>(
  resolver: (parent: any, args: TArgs, ctx: any) => any
) {
  return async (parent: any, args: TArgs, ctx: any) => {
    if (!ctx.user) throw new Error("Unauthorized");
    // If DB was reset (e.g. migrate dev), token can reference a deleted user id.
    if (ctx.prisma?.user) {
      const existingUser = await ctx.prisma.user.findUnique({
        where: { id: ctx.user.id },
        select: { id: true },
      });
      if (!existingUser) throw new Error("Unauthorized");
    }
    return resolver(parent, args, ctx);
  };
}

/** Throws if resource is missing or does not belong to the current user (use "Not found" to avoid leaking existence). */
export function ensureOwned(resource: { userId: string } | null, ctx: { user: { id: string } }) {
  if (!resource || resource.userId !== ctx.user.id) {
    throw new Error("Not found");
  }
}
