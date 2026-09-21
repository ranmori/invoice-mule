# Invoice Mule

A small invoicing app with an Expo client, a GraphQL API and Postgres, all in TypeScript. You can list invoices, create one with line items, and mark it paid.
I built it as a working sketch of the kind of thing Sticker Mule's upcoming Invoices tool has to get right.
The one hard problem I focused on: **invoice numbers are gapless and unique, even when requests arrive at the same moment.**

- **Live app:** https://invoice-mule.pages.dev
- **GraphQL API (with GraphiQL):** https://invoice-mule-api.onrender.com/graphql. It runs on a free host, so the first request can take ~30s while it wakes up.
- **Screen recording:** https://youtu.be/kRm6qczmfY0

## The interesting part: gapless invoice numbers

Invoice numbers are a legal and accounting sequence. `INV-0007` must not appear twice, and there shouldn't be a missing `INV-0006` that someone has to explain to an accountant.

[`api/src/invoiceNumber.ts`](api/src/invoiceNumber.ts) allocates the number in the **same transaction** as the invoice insert. It's a single statement, so the counter bump, the invoice and its line items all commit or all roll back together:

```sql
WITH bump AS (
  UPDATE "InvoiceCounter" SET "lastNumber" = "lastNumber" + 1
  WHERE "userId" = $1 RETURNING "lastNumber"
), invoice AS (
  INSERT INTO "Invoice" (..., "number", ...) SELECT ..., bump."lastNumber", ... FROM bump RETURNING "id", "number"
), items AS (
  INSERT INTO "LineItem" (...) SELECT ... FROM invoice, unnest($5::text[], ...) RETURNING 1
)
SELECT "id", "number" FROM invoice;
```

- The `UPDATE` takes a row lock on the user's counter, so concurrent creates queue behind each other. Each one reads the value the previous transaction committed.
- If anything fails (a bad client id, say), the statement rolls back, **including the increment**, so no number is burned.
- A `UNIQUE (userId, number)` constraint is the backstop. Even a future code path that bypasses the counter can't produce a duplicate.
- The lock is held for exactly one round trip. That matters more than it looks: see the connection-pool note in Decisions.

**The test** ([`api/test/gapless.test.ts`](api/test/gapless.test.ts)):

1. Fires **20 `createInvoice` mutations in parallel** through the real GraphQL handler, then asserts the numbers are exactly `1..20`: no gaps, no duplicates.
2. Fires 12 parallel creates where every 4th one fails *after* taking a number (bad foreign key). It asserts the 9 survivors are exactly `1..9` and the counter is at 9, which shows a rollback gives the number back.

To check that the test actually catches the race, I temporarily swapped the counter for the naive `SELECT MAX(number) + 1`. The test failed immediately, and the unique constraint rejected the colliding inserts (`Unique constraint failed on the fields: (userId, number)`). So both layers work.

The tests run against the real Postgres this deploys to (a Neon branch), not an in-memory fake, because the whole point is Postgres locking behaviour.

You can run the same burst against any running instance, including the deployed one:

```bash
npm run burst -- https://invoice-mule-api.onrender.com/graphql 20
# 20 created in 2916ms / duplicates: 0 / gaps: 0
```

Against the deployed API that returns 20 consecutive numbers every time, so this holds in production and not just under test.

## Run it locally

Requirements: Node 20+ and a Postgres database (I used a free [Neon](https://neon.tech) project with a second branch for tests).

```bash
npm run install:all

# API: copy api/.env.example to api/.env and fill in DATABASE_URL / DIRECT_URL
npm run db:migrate          # creates the tables
npm run db:seed             # demo user, 3 clients, 2 invoices
npm run dev:api             # http://localhost:4000/graphql

# App: copy app/.env.example to app/.env (defaults to the local API).
# EXPO_PUBLIC_API_URL is baked in at build time, so set it before exporting for deploy.
npm run dev:app             # press w for web, or scan the QR code with Expo Go

# Tests: copy api/.env.test.example to api/.env.test, pointing at a DISPOSABLE database.
# The suite deletes the contents of its tables between cases.
npm test
```

## Decisions

- **Counter row, not a Postgres `SEQUENCE`.** Sequences are deliberately non-transactional: a rolled-back insert still consumes a value, so you get gaps. **Not `MAX(number)+1` either**, because two transactions can read the same max (demonstrated above). The counter row serializes creates *per user*, which is the right granularity: one seller's invoices never block another's.
- **One statement, not an interactive transaction — because of the connection pool.** My first version opened a Prisma transaction and ran the increment and the inserts as separate queries. It passed against a local Postgres and then failed against Neon: every waiting caller holds a pooled connection *and* its lock wait across three round trips, so 20 parallel creates exhausted the pool and the queued transactions expired. Collapsing it into one statement holds the lock for a single round trip, and the same test passes against a remote database. Latency turns a design that looks fine locally into an outage.
- **Validation happens before the statement.** Input checks and the client ownership check run first, so nothing avoidable happens while the lock is held.
- **Money is integer cents.** No floats anywhere. Totals are computed on the server from line items, not stored, so they can't drift.
- **`markPaid` is idempotent.** It is a conditional update (`WHERE status = 'OPEN'`), so a retried request or a double tap returns the same invoice with the original `paidAt`.
- **The create button is disabled while a request is in flight**, so a double tap can't create (and number) two invoices. The proper server-side fix is an idempotency key. I'd add that next.
- **GraphQL Yoga with a plain SDL schema, no codegen.** The schema is ~60 lines, and codegen would have taken longer to set up than it saves at this size.
- **Prisma 6, not 7.** Prisma 7 changes the client and connection setup, and a 3-day build isn't the time to learn that. Neon's pooled URL is used at runtime and the direct URL for migrations, and the client pool is sized in [`api/src/context.ts`](api/src/context.ts) so a burst of 20 queues instead of failing.
- **Deployment: Cloudflare Pages for the app, Render for the API.** The app is a static Expo web export, so Pages serves it from the edge, with `app/public/_redirects` sending client-side routes back to `index.html`. The API is a plain Node server ([`render.yaml`](render.yaml)) rather than an edge function, because Prisma on Workers needs a driver adapter, and that wasn't where the remaining time was best spent.
- **urql** on the client, using its document cache and `additionalTypenames` so mutations refresh the lists. It's small and does exactly what three screens need.
- **Expo Router** with three screens. The same code runs on iOS, Android and web. The live link is the web export, so reviewers can click it without installing anything.

### Deliberately skipped

Following "deprioritize edge cases", I left these out on purpose rather than half-building them:

- **Login.** Every request acts as one seeded demo user. The schema is already per-user (`userId` on everything, counter per user), so adding auth means resolving `userId` from a session instead of a constant.
- **Payments.** "Mark paid" records that money arrived. It doesn't move any.
- **PDFs, email delivery, editing or voiding invoices, taxes, discounts, multi-currency, client management** (clients are seeded).

## How I built this with AI tools

I built this with Claude Code and leaned on it hard. It wrote nearly all of the code, drove a headless browser through the deployed app, and fired concurrent bursts at production to check the numbering held. The design was mine, because I built invoicing at Wrenta: a counter row updated in the same transaction as the insert, a unique constraint as the backstop, and a test that fires 20 parallel creates at real Postgres. That test paid for itself. The first version passed locally and failed against Neon, and Claude traced it to transactions holding pooled connections across three round trips, then rewrote the allocation as a single statement. I read every file, including that fix, and can walk through all of it. The AI got this from brief to a tested, deployed app in a weekend; deciding what had to be true, and insisting on proof, was my part.
