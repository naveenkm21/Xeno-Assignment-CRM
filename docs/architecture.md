# Architecture

Two services, callback-driven — exactly what the brief asks for. Everything
else flows from that.

## Components

```
                   ┌──────────────────────────────────────────────┐
   marketer ─chat──►  Xeno Copilot (apps/web — Next.js 15)        │
                   │                                              │
                   │  ┌────────────────┐  ┌──────────────────┐    │
                   │  │ Copilot agent  │  │ Audience engine  │    │
                   │  │ (Groq Llama)   │  │ (NL → SQL filter)│    │
                   │  └────────┬───────┘  └────────┬─────────┘    │
                   │           │                   │              │
                   │  ┌────────▼───────────────────▼─────────┐    │
                   │  │ Campaigns API · materializes audience │    │
                   │  │ inserts communications · POST /send   │    │
                   │  └────────────────┬──────────────────────┘    │
                   │           ┌───────▼────────┐                  │
                   │           │ Receipt API    │◄── async POST ───┼──┐
                   │           │ HMAC-verified, │                  │  │
                   │           │ idempotent     │                  │  │
                   │           └────────────────┘                  │  │
                   └────────────────┬──────────────────────────────┘  │
                                    │ Neon Postgres                   │
                                    │ (Drizzle ORM)                   │
                                    │                                 │
                                    │ POST /send (callbackUrl)        │
                                    ▼                                 │
                   ┌──────────────────────────────────────────────┐   │
                   │ Channel stub (apps/channel — Express)        │   │
                   │  • BullMQ queue (Upstash Redis)              │   │
                   │  • Worker: simulates lifecycle per channel   │───┘
                   │    (sent → delivered → opened → clicked →    │
                   │     converted, with realistic distributions) │
                   │  • POSTs receipts back, HMAC-signed,         │
                   │    retries with backoff                      │
                   └──────────────────────────────────────────────┘
```

## The two service boundary

The brief is explicit: stub the channel as a separate service with a
callback-driven loop. This boundary shapes the rest of the design.

- **CRM side knows nothing about channel delivery mechanics.** It hands a
  batch of communications to `POST /send` and goes back to whatever it was
  doing. State updates arrive asynchronously.
- **Channel side knows nothing about who the customer is.** It receives
  enough to deliver (recipient identifiers, body, channel) and emits
  lifecycle events. In a real deployment, swapping the stub for Twilio /
  Karix / Gupshup means writing one adapter, not refactoring the CRM.

## The lifecycle, as a state machine

```
                  queued
                    │
                  send()
                    │
                    ▼
                   sent  ────►  failed  (terminal)
                    │
                    ▼
                delivered ────► bounced (terminal)
                    │
                    ▼
                  opened
                    │
                    ▼
                  clicked
                    │
                    ▼
                 converted (terminal)
```

`failed`, `bounced`, `unsubscribed`, `converted` are sticky. Once a comm
hits one of those, no later event can change its state. The
`shouldAdvance` check in [the receipt route](../apps/web/src/app/api/receipt/route.ts)
enforces this, and the unique index on `(comm_id, state, occurred_at)` in
`comm_events` enforces idempotency at the row level.

## Idempotency, ordering, retries

The brief specifically asks how I model these. Here's the bet:

| Concern        | Where it's solved                                            |
| -------------- | ------------------------------------------------------------ |
| Idempotency    | Unique index on `(comm_id, state, occurred_at)`. A duplicate webhook just gets dropped on `ON CONFLICT DO NOTHING`. |
| Ordering       | Late receipts can't regress state — the rank check (`opened` < `clicked`) blocks it. Reasoning: the event log is the source of truth; `communications.state` is a denormalized projection. |
| Retries        | Channel stub retries `/receipt` POSTs up to 3× with exponential backoff. The CRM's idempotency makes retries safe. |
| Failure budget | Each comm is one BullMQ job, capped at 3 attempts. Permanent failures end as `failed` receipts — surfaced in the live monitor and the insights summary. |

## Why these specific choices

- **Drizzle over Prisma**: Neon HTTP driver, tighter bundle, easier
  inspection of generated SQL.
- **BullMQ on Upstash Redis** (free tier) over building our own queue. The
  alternatives (raw `setTimeout`, Postgres `LISTEN/NOTIFY`) work for a
  demo but obscure the point — at real scale you do want a real queue.
- **Groq + Llama 3.3 70B** for the planner — best price/quality on free
  tier for tool-use. **Llama 3.1 8B** for message drafting because it's
  fast and the task is bounded.
- **Next.js App Router** for the web app — server components let the home
  page and campaign list render straight from Postgres without an API
  hop; SSE from API routes covers the streaming agent.
- **Clerk** because it's the fastest free way to get auth without writing
  it. Doesn't ship anything that distinguishes the submission, so use the
  hosted thing.

## What lives where

| Concern | Code |
| ------- | ---- |
| Data model | [`packages/db/src/schema.ts`](../packages/db/src/schema.ts) |
| Shared types & wire schemas | [`packages/types/src/index.ts`](../packages/types/src/index.ts) |
| Agent loop | [`packages/ai/src/agent.ts`](../packages/ai/src/agent.ts) |
| Agent tools | [`packages/ai/src/tools/`](../packages/ai/src/tools/) |
| Audience materialization | [`apps/web/src/lib/audience.ts`](../apps/web/src/lib/audience.ts) |
| Campaign creation + send dispatch | [`apps/web/src/app/api/campaigns/route.ts`](../apps/web/src/app/api/campaigns/route.ts) |
| Receipt ingestion | [`apps/web/src/app/api/receipt/route.ts`](../apps/web/src/app/api/receipt/route.ts) |
| Lifecycle simulator | [`apps/channel/src/simulate.ts`](../apps/channel/src/simulate.ts) |
| Send worker (signs + retries receipts) | [`apps/channel/src/worker.ts`](../apps/channel/src/worker.ts) |
