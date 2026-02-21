import express from "express";
import { ApolloServer } from "apollo-server-express";
import { typeDefs, resolvers } from "./graphql";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { env } from "process";
import cors from "cors";

const prisma = new PrismaClient();
const app = express();

const corsOrigins =
  process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  })
);

const getUserFromToken = (req: any) => {
  const JWT_SECRET = env.JWT_SECRET || "dev-secret";
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  const token = auth.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { id: decoded.userId };
  } catch {
    return null;
  }
};

async function startServer() {
  const PORT = env.PORT || 4000;
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => ({
      user: getUserFromToken(req),
      prisma,
    }),
  });

  await server.start();
  server.applyMiddleware({ app: app as any });

  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
}

startServer();
