import express from "express";
import { ApolloServer } from "apollo-server-express";
import { typeDefs, resolvers } from "./graphql";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const app = express();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const PORT = process.env.PORT || 4000;

const getUserFromToken = (req: any) => {
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

  app.listen(4000, () => {
    console.log("🚀 Server ready at http://localhost:4000/graphql");
  });
}

startServer();
