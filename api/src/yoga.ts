import { createYoga } from "graphql-yoga";
import { getDemoUserId, prisma } from "./context.js";
import { schema } from "./schema.js";

export const yoga = createYoga({
  schema,
  context: async () => ({ prisma, userId: await getDemoUserId() }),
  // Open CORS: this is a public demo with no auth.
  cors: { origin: "*" },
  graphiql: true,
});
