import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";
import type { Invoice, LineItem } from "@prisma/client";
import type { Context } from "./context.js";
import { createInvoiceWithNumber, type NewLineItem } from "./invoiceNumber.js";

const typeDefs = /* GraphQL */ `
  enum InvoiceStatus {
    OPEN
    PAID
  }

  type Client {
    id: ID!
    name: String!
    email: String!
  }

  type LineItem {
    id: ID!
    description: String!
    quantity: Int!
    unitPriceCents: Int!
    totalCents: Int!
  }

  type Invoice {
    id: ID!
    number: Int!
    "Human-facing number, e.g. INV-0007"
    displayNumber: String!
    status: InvoiceStatus!
    client: Client!
    issueDate: String!
    dueDate: String!
    paidAt: String
    lineItems: [LineItem!]!
    totalCents: Int!
  }

  type Query {
    clients: [Client!]!
    invoices: [Invoice!]!
    invoice(id: ID!): Invoice
  }

  input LineItemInput {
    description: String!
    quantity: Int!
    unitPriceCents: Int!
  }

  input CreateInvoiceInput {
    clientId: ID!
    "ISO date, e.g. 2026-10-01"
    dueDate: String!
    lineItems: [LineItemInput!]!
  }

  type Mutation {
    createInvoice(input: CreateInvoiceInput!): Invoice!
    "Idempotent: marking an already-paid invoice returns it unchanged."
    markPaid(id: ID!): Invoice!
  }
`;

type CreateInvoiceInput = { clientId: string; dueDate: string; lineItems: NewLineItem[] };

const invoiceInclude = { lineItems: true, client: true } as const;

function validate(input: CreateInvoiceInput): Date {
  if (input.lineItems.length === 0) throw new GraphQLError("An invoice needs at least one line item.");
  for (const item of input.lineItems) {
    if (!item.description.trim()) throw new GraphQLError("Every line item needs a description.");
    if (item.quantity <= 0) throw new GraphQLError("Quantity must be greater than zero.");
    if (item.unitPriceCents < 0) throw new GraphQLError("Unit price cannot be negative.");
  }
  const dueDate = new Date(input.dueDate);
  if (Number.isNaN(dueDate.getTime())) throw new GraphQLError("Due date is not a valid date.");
  return dueDate;
}

const resolvers = {
  Query: {
    clients: (_: unknown, __: unknown, { prisma, userId }: Context) =>
      prisma.client.findMany({ where: { userId }, orderBy: { name: "asc" } }),
    invoices: (_: unknown, __: unknown, { prisma, userId }: Context) =>
      prisma.invoice.findMany({ where: { userId }, orderBy: { number: "desc" }, include: invoiceInclude }),
    invoice: (_: unknown, { id }: { id: string }, { prisma, userId }: Context) =>
      prisma.invoice.findFirst({ where: { id, userId }, include: invoiceInclude }),
  },
  Mutation: {
    createInvoice: async (_: unknown, { input }: { input: CreateInvoiceInput }, { prisma, userId }: Context) => {
      const dueDate = validate(input);
      const client = await prisma.client.findFirst({ where: { id: input.clientId, userId } });
      if (!client) throw new GraphQLError("Client not found.");
      return createInvoiceWithNumber(prisma, {
        userId,
        clientId: client.id,
        dueDate,
        lineItems: input.lineItems.map((i) => ({ ...i, description: i.description.trim() })),
      });
    },
    markPaid: async (_: unknown, { id }: { id: string }, { prisma, userId }: Context) => {
      // Conditional update: only an OPEN invoice changes, so repeating the call is safe.
      await prisma.invoice.updateMany({
        where: { id, userId, status: "OPEN" },
        data: { status: "PAID", paidAt: new Date() },
      });
      const invoice = await prisma.invoice.findFirst({ where: { id, userId }, include: invoiceInclude });
      if (!invoice) throw new GraphQLError("Invoice not found.");
      return invoice;
    },
  },
  Invoice: {
    displayNumber: (inv: Invoice) => `INV-${String(inv.number).padStart(4, "0")}`,
    issueDate: (inv: Invoice) => inv.issueDate.toISOString(),
    dueDate: (inv: Invoice) => inv.dueDate.toISOString(),
    paidAt: (inv: Invoice) => inv.paidAt?.toISOString() ?? null,
    totalCents: (inv: Invoice & { lineItems: LineItem[] }) =>
      inv.lineItems.reduce((sum, li) => sum + li.quantity * li.unitPriceCents, 0),
  },
  LineItem: {
    totalCents: (li: LineItem) => li.quantity * li.unitPriceCents,
  },
};

export const schema = createSchema<Context>({ typeDefs, resolvers });
