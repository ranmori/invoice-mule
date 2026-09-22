import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { DEMO_USER_EMAIL, prisma } from "../src/context.js";
import { createInvoiceWithNumber } from "../src/invoiceNumber.js";
import { yoga } from "../src/yoga.js";

let userId: string;
let clientId: string;

beforeEach(async () => {
  // DELETE, not TRUNCATE: TRUNCATE needs an exclusive table lock, which deadlocks
  // against transactions still finishing from a previous test.
  await prisma.$executeRawUnsafe(`DELETE FROM "LineItem"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Invoice"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Client"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "InvoiceCounter"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "User"`);
  const user = await prisma.user.create({
    data: {
      name: "Test Seller",
      email: DEMO_USER_EMAIL,
      counter: { create: {} },
      clients: { create: { name: "Test Client", email: "client@test.example" } },
    },
    include: { clients: true },
  });
  userId = user.id;
  clientId = user.clients[0].id;
});

afterAll(() => prisma.$disconnect());

const CREATE_INVOICE = /* GraphQL */ `
  mutation ($input: CreateInvoiceInput!) {
    createInvoice(input: $input) { number displayNumber }
  }
`;

async function createViaGraphQL(i: number) {
  const res = await yoga.fetch("http://test/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      query: CREATE_INVOICE,
      variables: {
        input: {
          clientId,
          dueDate: "2026-12-31",
          lineItems: [{ description: `Stickers batch ${i}`, quantity: 100, unitPriceCents: 50 }],
        },
      },
    }),
  });
  const body = (await res.json()) as { data?: { createInvoice: { number: number } }; errors?: unknown };
  expect(body.errors).toBeUndefined();
  return body.data!.createInvoice.number;
}

const oneToN = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe("gapless invoice numbers", () => {
  it("20 parallel createInvoice calls get exactly 1..20", async () => {
    const numbers = await Promise.all(Array.from({ length: 20 }, (_, i) => createViaGraphQL(i)));

    expect(new Set(numbers).size).toBe(20);
    expect([...numbers].sort((a, b) => a - b)).toEqual(oneToN(20));

    const stored = await prisma.invoice.findMany({ where: { userId }, orderBy: { number: "asc" } });
    expect(stored.map((inv) => inv.number)).toEqual(oneToN(20));
  });

  it("a failed insert releases its number instead of leaving a gap", async () => {
    // Every 4th call points at a client that doesn't exist, so the insert fails with a
    // foreign-key error *after* the counter was incremented. That transaction must roll back.
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        createInvoiceWithNumber(prisma, {
          userId,
          clientId: i % 4 === 3 ? "missing-client" : clientId,
          dueDate: new Date("2026-12-31"),
          lineItems: [{ description: `Item ${i}`, quantity: 1, unitPriceCents: 100 }],
        }),
      ),
    );

    expect(results.filter((r) => r.status === "rejected")).toHaveLength(3);
    const stored = await prisma.invoice.findMany({ where: { userId }, orderBy: { number: "asc" } });
    expect(stored.map((inv) => inv.number)).toEqual(oneToN(9));

    const counter = await prisma.invoiceCounter.findUniqueOrThrow({ where: { userId } });
    expect(counter.lastNumber).toBe(9);
  });

  it("a missing counter row is an error, not a silent no-op", async () => {
    // With no counter row the UPDATE matches nothing, so the CTE inserts zero rows
    // and raises no SQL error. The caller must notice and throw.
    await prisma.invoiceCounter.delete({ where: { userId } });

    await expect(
      createInvoiceWithNumber(prisma, {
        userId,
        clientId,
        dueDate: new Date("2026-12-31"),
        lineItems: [{ description: "Orphan", quantity: 1, unitPriceCents: 100 }],
      }),
    ).rejects.toThrow("No invoice counter");

    expect(await prisma.invoice.count()).toBe(0);
    expect(await prisma.lineItem.count()).toBe(0);
  });
});
