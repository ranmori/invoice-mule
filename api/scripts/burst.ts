/**
 * Fires N createInvoice mutations at once and reports the numbers they got.
 * Run against the deployed API to show the gapless guarantee holding in production:
 *   npm run burst                         (local API)
 *   npm run burst -- https://invoice-mule-api.onrender.com/graphql 20
 */
const url = process.argv[2] ?? "http://localhost:4000/graphql";
const count = Number(process.argv[3] ?? 20);

const gql = async (query: string, variables?: unknown) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data?: any; errors?: { message: string }[] };
};

const CREATE = `mutation ($input: CreateInvoiceInput!) {
  createInvoice(input: $input) { displayNumber }
}`;

const clients = await gql(`{ clients { id name } }`);
if (!clients.data?.clients?.length) throw new Error(`No clients at ${url}. Run npm run db:seed first.`);
const clientId = clients.data.clients[0].id;

console.log(`\nFiring ${count} createInvoice mutations at ${url}\n`);
const started = Date.now();
const results = await Promise.all(
  Array.from({ length: count }, (_, i) =>
    gql(CREATE, {
      input: {
        clientId,
        dueDate: "2026-12-31",
        lineItems: [{ description: `Concurrent order ${i + 1}`, quantity: 1, unitPriceCents: 1000 }],
      },
    }),
  ),
);
const elapsed = Date.now() - started;

const numbers = results.flatMap((r) => (r.data ? [r.data.createInvoice.displayNumber as string] : []));
const failures = results.flatMap((r) => r.errors?.map((e) => e.message) ?? []);
const sorted = [...numbers].sort();

console.log(sorted.join("  "));
console.log(`\n${numbers.length} created in ${elapsed}ms${failures.length ? `, ${failures.length} failed` : ""}`);

const asInts = sorted.map((n) => Number(n.replace("INV-", "")));
const duplicates = asInts.filter((n, i) => i > 0 && n === asInts[i - 1]);
const gaps = asInts.filter((n, i) => i > 0 && n !== asInts[i - 1] + 1);

console.log(`duplicates: ${duplicates.length}`);
console.log(`gaps:       ${gaps.length}`);
console.log(duplicates.length === 0 && gaps.length === 0 ? "\nGapless. \n" : "\nBROKEN\n");
if (failures.length) console.log("errors:", [...new Set(failures)].join(" | "));
