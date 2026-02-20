import { queryResolvers } from "./query";
import { mutationResolvers } from "./mutations";
import { typeResolvers } from "./typeResolvers";

export const resolvers = {
  Query: queryResolvers,
  Mutation: mutationResolvers,
  ...typeResolvers,
};
