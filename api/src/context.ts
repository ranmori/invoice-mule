import { PrismaClient } from "@prisma/client";

/**
 * Invoice creation holds its connection while it waits for the counter row lock,
 * so a burst of concurrent creates needs more connections than Prisma's default
 * pool of (cores * 2 + 1), and needs to be willing to wait longer for one.
 * Without this, 20 parallel createInvoice calls against a remote database fail with
 * "Timed out fetching a new connection from the connection pool" rather than queueing.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  const url = new URL(raw);
  if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "25");
  if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "30");
  return url.toString();
}

export const prisma = new PrismaClient({ datasourceUrl: datasourceUrl() });

// Login is deliberately out of scope: every request acts as the seeded demo user.
export const DEMO_USER_EMAIL = "demo@invoicemule.dev";

export async function getDemoUserId(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_USER_EMAIL }, select: { id: true } });
  return user.id;
}

export type Context = { prisma: PrismaClient; userId: string };
