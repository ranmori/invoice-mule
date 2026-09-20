import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";

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
 * Everything happens in ONE statement, so it is one transaction with the shortest
 * possible critical section:
 * - `UPDATE ... RETURNING` takes a row lock on the user's counter, so concurrent
 *   creates queue behind each other and each reads the previously committed value.
 * - The invoice and its line items are inserted from that same statement. If any part
 *   fails (a bad client id, say), the whole statement rolls back, *including the
 *   increment*, so the number is never lost. A Postgres SEQUENCE would leave a gap.
 * - `UNIQUE (userId, number)` is the backstop against any path that bypasses the counter.
 *
 * Why one statement rather than an interactive transaction: the lock is held for a
 * single round trip. With a multi-query transaction, every waiting caller holds both
 * a pooled connection and its lock wait across several round trips, and against a
 * remote database a burst of 20 exhausts the connection pool and times out.
 */
export async function createInvoiceWithNumber(prisma: PrismaClient, input: NewInvoice) {
  const invoiceId = randomUUID();
  const itemIds = input.lineItems.map(() => randomUUID());

  const rows = await prisma.$queryRaw<{ id: string; number: number }[]>`
    WITH bump AS (
      UPDATE "InvoiceCounter"
      SET "lastNumber" = "lastNumber" + 1
      WHERE "userId" = ${input.userId}
      RETURNING "lastNumber"
    ), invoice AS (
      INSERT INTO "Invoice" ("id", "userId", "clientId", "number", "status", "issueDate", "dueDate", "createdAt")
      SELECT ${invoiceId}, ${input.userId}, ${input.clientId}, bump."lastNumber",
             'OPEN'::"InvoiceStatus", now(), ${input.dueDate}, now()
      FROM bump
      RETURNING "id", "number"
    ), items AS (
      INSERT INTO "LineItem" ("id", "invoiceId", "description", "quantity", "unitPriceCents")
      SELECT item.id, invoice."id", item.description, item.quantity, item.price
      FROM invoice, unnest(
        ${itemIds}::text[],
        ${input.lineItems.map((i) => i.description)}::text[],
        ${input.lineItems.map((i) => i.quantity)}::int[],
        ${input.lineItems.map((i) => i.unitPriceCents)}::int[]
      ) AS item(id, description, quantity, price)
      RETURNING 1
    )
    SELECT "id", "number" FROM invoice`;

  if (rows.length === 0) throw new Error(`No invoice counter for user ${input.userId}`);

  // Read back outside the lock.
  return prisma.invoice.findUniqueOrThrow({
    where: { id: rows[0].id },
    include: { lineItems: true, client: true },
  });
}
