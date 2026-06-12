# Tradeoffs

What I'd build differently at real scale, and why I shipped the simpler version
for this assignment.

## Scale assumptions for this build

- **Brand size**: one tenant ("Aroma Coffee Co."), ~5k shoppers, ~30k orders.
- **Campaign size**: ≤ 10k communications per campaign.
- **Concurrency**: a single marketer driving the copilot at a time. Receipts
  arrive at low double-digit per-second peaks.
- **Latency budget**: copilot first token < 1 s, full plan < 8 s, live monitor
  updates within ~2 s of receipt arrival.

These are demo-scale. Everything below holds up to roughly 10× these numbers
before something needs to change.

## Where the design would have to change

### 1. The agent loop is in the request path

Today: `POST /api/copilot` opens an SSE stream and runs the agent loop
synchronously, with the planner LLM calling tools in sequence. Total time is
typically 4–8 s.

**Why this is fine for the demo**: one marketer, fast Groq inference, the
loop is single-digit turns. Holding a Vercel function open for 8 s is well
within `maxDuration: 60`.

**What changes at scale**:

- Push the agent into a background job queued via the same Redis/BullMQ
  infrastructure. The chat UI polls (or subscribes via WebSocket) for trace
  events. This removes the function-timeout ceiling and lets us retry partial
  plans.
- Add a planner-level cache keyed on `(brand_id, normalized_brief)` — many
  marketers brief variations of the same goal ("win-back lapsed", "VIP push").
  Even a 30 % hit rate on the first tool call (audience query) cuts LLM cost
  meaningfully.
- Move the structured-output validation outside the loop: the agent emits a
  proposed plan, a validator service checks it against the schema + business
  rules (opt-in, send window, discount cap) before the UI ever sees it.

### 2. Channel sends go through BullMQ — would be Kafka at scale

Today: `POST /api/campaigns` materializes the audience (one Postgres query),
inserts ~5k `communications` rows in chunks of 500, then `POST`s 200 at a
time to the channel stub which enqueues them in BullMQ.

**Why this is fine**: BullMQ on Upstash handles ~1k jobs/s for free. The
demo sends 5k jobs per campaign — well inside the envelope.

**What changes at scale**:

- BullMQ is fine up to a few million jobs/day. Beyond that, switch the
  send pipe to **Kafka** (or any partition-shardable log) keyed by
  `customer_id`. This gives us natural rate isolation per customer, retries
  via consumer-offset rewinds, and a clean replay story.
- The `materializeAudience` query gets pushed into a stored snapshot on
  audience approval — re-running it on every send would lock the orders
  table on a large dataset. We'd snapshot to a `campaign_targets` table and
  send from that.

### 3. The receipt ingester is single-tenant per row

Today: receipts arrive at `POST /api/receipt`, we verify HMAC, append-only
insert into `comm_events` (idempotent via unique constraint), then
read-modify-write the `communications` row.

**Why this is fine**: the channel stub is the only writer, sends serially
per comm, and we never have two ingesters racing on the same row. The
idempotency on `comm_events` is the actual correctness anchor — the
communications.state update is a derived view.

**What changes at scale**:

- Two services in parallel can race on the communications row. Today this
  could produce a stale state (incoming `delivered` arrives between a
  `clicked` ingester's SELECT and UPDATE). Fix: either (a) replace
  read-modify-write with a single CTE that derives state from the event
  log atomically, or (b) introduce row-level locking via `SELECT FOR
  UPDATE`. I'd pick (a) — derived state means we can rebuild from events
  at any time.
- Move ingestion to a queue. POST `/api/receipt` immediately writes to the
  `comm_events` table (the cheap append) and enqueues a roll-up job.
  Marketing dashboards read the roll-up; the queue smooths spiky loads
  (campaigns that burst-deliver in 30 s).
- Shard the queue by `hash(comm_id) % N` so any given comm's events are
  ordered.

### 4. Postgres is the only store

Today: Neon Postgres holds customers, orders, audiences, campaigns,
communications, and the event log. Drizzle is the only client.

**Why this is fine**: the working set fits in a couple of GB. Neon's HTTP
driver makes Postgres a fine fit for serverless functions.

**What changes at scale**:

- Move `comm_events` into a columnar warehouse (ClickHouse, BigQuery) and
  keep the operational copy in Postgres limited to the last 30 days.
  Insights queries (channel × variant × cohort over months) belong in the
  warehouse.
- Snapshot audience filters into `customers_audience` rollup tables so the
  audience CTE doesn't re-aggregate orders on every send.
- Use Postgres logical replication to pipe customers/orders into a vector
  store for semantic audience filters ("shoppers who like sweet, fruity
  beans") — a natural extension of the copilot.

### 5. The channel stub runs the worker in-process

Today: `apps/channel` boots both the Express HTTP listener and the BullMQ
worker in the same Node process. Easier to develop, easier to deploy.

**Why this is fine**: Fly.io free tier gives us one always-on machine and
the demo load is trivial.

**What changes at scale**:

- Split worker and API into separate deployables. The worker scales on
  queue depth; the API scales on RPS. Different shapes.
- Add a dedicated dead-letter queue so the receipt-poster's retry storms
  don't recycle bad jobs indefinitely.

### 6. We trust the agent's tool calls

Today: when the planner LLM calls `query_audience`, we run the filter
verbatim. If it asks for "last_order_at < -3650 days" we don't push back.

**Why this is fine**: the audience filter schema is narrow — only known
fields, only known ops, only opt-in shoppers can ever be addressed.

**What changes at scale**:

- Add a policy layer between the LLM and the tools: "discount > 25 % needs
  approval", "audience > 50 k needs a dry-run estimate first", "outside
  09:00–21:00 IST needs explicit override". The agent prompt already
  carries these as rules; in prod they have to be enforced after the
  call, not before.
- Add an LLM-judge eval step on the final plan: does the message body
  contain the merge field, does it mention the offer, does it match the
  brand tone? Score < threshold → regenerate.

## What I deliberately didn't build

Listed for transparency — every one was a conscious omission, not an
oversight.

- **Journey builder UI**: no drag-and-drop canvas. The chat is the builder.
- **Template library**: no saved-message vault. The copilot drafts fresh
  every time; winning variants get saved as a CTA in the insights view but
  the lookup is not implemented.
- **A/B significance testing**: variant lift is shown as raw percentages,
  not stat-significant. At the audience sizes we run, half the tests
  wouldn't be significant anyway — the honest move is to call this out
  rather than fake a p-value.
- **Permissions, multi-tenant**: one brand, one user role. Clerk's
  organization feature would slot in cleanly.
- **Real webhooks from real providers**: the channel is stubbed per the
  brief. The receipt ingester is provider-agnostic — it would accept
  Twilio/Karix/Gupshup signatures with a small adapter.
- **CSV/import UI for customers**: the seed script does this for the demo.
  A real product needs a mapping wizard, but that's a 3-day slice of work
  that doesn't reveal anything about my agent design.

## What I'd ship next (if I had another week)

1. **Audience semantic search**: a vector index of customer attributes so
   the marketer can ask "shoppers who probably like our espresso line".
2. **Live A/B traffic split + interim stopping rule**: the agent decides
   the split, monitors lift, and pauses the losing variant automatically.
3. **Send-time personalization**: per-customer best-hour-to-send, learned
   from open histograms over the last 90 days.
4. **A "what changed" Slack digest**: every morning, the copilot drops a
   3-bullet message: "yesterday's win-back beat target by 22 %, here's
   why, here's what I'd run next."
