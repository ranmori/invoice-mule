import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Login is deliberately out of scope: every request acts as the seeded demo user.
export const DEMO_USER_EMAIL = "demo@invoicemule.dev";

export async function getDemoUserId(): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: DEMO_USER_EMAIL }, select: { id: true } });
  return user.id;
}

export type Context = { prisma: PrismaClient; userId: string };
