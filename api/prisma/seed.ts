import { PrismaClient } from "@prisma/client";
import { createInvoiceWithNumber } from "../src/invoiceNumber.js";
import { DEMO_USER_EMAIL } from "../src/context.js";

const prisma = new PrismaClient();

const clients = [
  { name: "Brew Brothers Coffee", email: "orders@brewbrothers.example" },
  { name: "Northside Skate Co.", email: "hello@northsideskate.example" },
  { name: "Pixel Pines Studio", email: "billing@pixelpines.example" },
];

async function main() {
  // Start from a clean slate so the demo always shows INV-0001 onwards.
  await prisma.lineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.client.deleteMany();
  await prisma.invoiceCounter.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Demo Seller",
      email: DEMO_USER_EMAIL,
      counter: { create: { lastNumber: 0 } },
      clients: { create: clients },
    },
    include: { clients: true },
  });

  const [brew, skate] = user.clients;
  const inDays = (d: number) => new Date(Date.now() + d * 86_400_000);

  await createInvoiceWithNumber(prisma, {
    userId: user.id,
    clientId: brew.id,
    dueDate: inDays(-5),
    lineItems: [
      { description: "Die cut stickers 3\" x 3\"", quantity: 500, unitPriceCents: 42 },
      { description: "Rush production", quantity: 1, unitPriceCents: 2500 },
    ],
  });
  const second = await createInvoiceWithNumber(prisma, {
    userId: user.id,
    clientId: skate.id,
    dueDate: inDays(14),
    lineItems: [{ description: "Holographic stickers 2\" x 2\"", quantity: 1000, unitPriceCents: 31 }],
  });
  await prisma.invoice.update({ where: { id: second.id }, data: { status: "PAID", paidAt: new Date() } });

  console.log(`Seeded demo user ${user.email} with ${user.clients.length} clients and 2 invoices.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
