import type { Prisma, PrismaClient } from "@prisma/client";

export type NewLineItem = { description: string; quantity: number; unitPriceCents: number };

export type NewInvoice = {
  userId: string;
  clientId: string;
  dueDate: Date;
  lineItems: NewLineItem[];
};

/**
 * Creates an invoice with the next gapless number for its user.
 *
 * The counter increment and the invoice insert share one transaction:
 * - `UPDATE ... RETURNING` takes a row lock, so concurrent callers queue on the
 *   counter row, and each one sees the value the previous one committed.
 * - If anything after the increment fails, the increment rolls back too, so the
 *   number is never lost. (A Postgres SEQUENCE would leave a gap here.)
 * - The unique (userId, number) constraint rejects duplicates if this is ever bypassed.
 */
export function createInvoiceWithNumber(prisma: PrismaClient, input: NewInvoice) {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.$queryRaw<{ lastNumber: number }[]>`
        UPDATE "InvoiceCounter"
        SET "lastNumber" = "lastNumber" + 1
        WHERE "userId" = ${input.userId}
        RETURNING "lastNumber"`;
      if (rows.length === 0) throw new Error(`No invoice counter for user ${input.userId}`);

      return tx.invoice.create({
        data: {
          number: rows[0].lastNumber,
          userId: input.userId,
          clientId: input.clientId,
          dueDate: input.dueDate,
          lineItems: { create: input.lineItems },
        },
        include: { lineItems: true, client: true },
      });
    },
    // Parallel requests wait for a pooled connection and then for the row lock.
    // Prisma's default maxWait of 2s is too short for a burst of 20.
    { maxWait: 15_000, timeout: 15_000 },
  ) satisfies Promise<Prisma.InvoiceGetPayload<{ include: { lineItems: true; client: true } }>>;
}
