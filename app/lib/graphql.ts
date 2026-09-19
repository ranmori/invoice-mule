import { cacheExchange, Client, fetchExchange, gql } from "urql";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000/graphql";

export const client = new Client({
  url: API_URL,
  exchanges: [cacheExchange, fetchExchange],
});

export type InvoiceStatus = "OPEN" | "PAID";

export type InvoiceSummary = {
  id: string;
  displayNumber: string;
  status: InvoiceStatus;
  dueDate: string;
  totalCents: number;
  client: { id: string; name: string };
};

export type InvoiceDetail = InvoiceSummary & {
  issueDate: string;
  paidAt: string | null;
  client: { id: string; name: string; email: string };
  lineItems: { id: string; description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
};

export const INVOICES = gql`
  query Invoices {
    invoices {
      id
      displayNumber
      status
      dueDate
      totalCents
      client { id name }
    }
  }
`;

export const INVOICE = gql`
  query Invoice($id: ID!) {
    invoice(id: $id) {
      id
      displayNumber
      status
      issueDate
      dueDate
      paidAt
      totalCents
      client { id name email }
      lineItems { id description quantity unitPriceCents totalCents }
    }
  }
`;

export const CLIENTS = gql`
  query Clients {
    clients { id name email }
  }
`;

export const CREATE_INVOICE = gql`
  mutation CreateInvoice($input: CreateInvoiceInput!) {
    createInvoice(input: $input) { id displayNumber }
  }
`;

export const MARK_PAID = gql`
  mutation MarkPaid($id: ID!) {
    markPaid(id: $id) { id status paidAt }
  }
`;

// The document cache refetches queries that returned these types after a mutation touches them.
export const invoiceContext = { additionalTypenames: ["Invoice"] };
