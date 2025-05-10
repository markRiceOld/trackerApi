import express from "express";
import { ApolloServer } from "apollo-server-express";
import { typeDefs, resolvers } from "./graphql";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const app = express();

async function startServer() {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: () => ({ prisma }),
  });

  await server.start();
  server.applyMiddleware({ app: app as any });

  app.listen(4000, () => {
    console.log("🚀 Server ready at http://localhost:4000/graphql");
  });
}

startServer();
