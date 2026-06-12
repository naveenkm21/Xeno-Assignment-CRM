# Walkthrough video — script outline

Target length: 5–6 minutes. Time targets are deliberately tight; cut if
you're over.

## 0:00 — Product intro (~30 s)

> "I built **Xeno Copilot**, a chat-first agentic mini CRM for D2C brands.
> The brief asked me to commit to a point of view on what 'AI-native' means
> — so I bet on the most aggressive interpretation: the marketer talks to
> an AI agent that proposes the audience, drafts the messages, picks the
> channel, sends, and reports back. Classic CRM screens exist as inspect
> surfaces, but you can't *not* talk to the copilot."

Show the home screen — the chat box is the only prominent CTA.

## 0:30 — Functional demo (~1:30)

1. **Home → brief the copilot.** Click "Win back lapsed shoppers". (10s)
2. **Live agent trace.** Show the `query_audience` chip flipping from
   "running" to "4,820 shoppers", then the `propose_channel_mix` call,
   then `draft_message` for WhatsApp variant A and B. (30s)
3. **Plan preview.** Audience pill, channel mix, send window, two message
   variants visible. Point out the WhatsApp body — note the merge field
   `{{first_name}}`. (15s)
4. **Approve & send.** Land on `/campaigns/[id]` — funnel updating in
   real time, channel split bar, the live event log streaming `delivered`
   → `opened` → `clicked` events. (25s)
5. **Wait ~30 s, scroll to insights.** Copilot summary appears: winning
   channel, winning variant, recommended next step. (10s)

## 2:00 — Technical architecture (~1:00)

Pull up `docs/architecture.md` or a slide of the diagram.

> "Two services, callback-driven, because the brief asks for exactly that
> shape. The web app handles UI, the agent loop, and receipt ingestion.
> The channel stub is a separate Express service running BullMQ on Upstash
> Redis — it simulates the lifecycle and POSTs back with HMAC signatures."

Highlight three system-design choices:

1. **Idempotency via unique index on (comm_id, state, occurred_at)** —
   duplicate webhooks just drop on conflict.
2. **Lifecycle rank check** so late `delivered` events can't overwrite a
   `clicked` we already saw.
3. **Append-only event log + denormalized state column** — the events
   table is the source of truth, the state column is a fast projection
   for the live monitor.

## 3:00 — Code walkthrough (~1:00)

Two files. Don't try to cover more.

1. **`packages/ai/src/agent.ts`** — the agent loop. Walk through:
   - The `MAX_TURNS = 6` budget — stops runaway tool calls.
   - The `messages.push(msg)` after every assistant turn — Groq sees the
     full history including tool results.
   - The "finalize_plan" early-exit — the agent is allowed exactly one
     terminal tool, which is also what the UI renders for approval.
2. **`apps/web/src/app/api/receipt/route.ts`** — the ingester. Highlight:
   - HMAC verification before parsing JSON.
   - `onConflictDoNothing` on the event log.
   - `shouldAdvance` rank logic so we don't regress state.
   - The campaign-completion check at the end so the status flips
     automatically.

## 4:00 — AI-native dev workflow (~1:00)

> "I leaned heavily on AI pair programming throughout. The workflow looked
> like this:"

- **Paper prototype first.** Rendered the screen flows before writing a
  line of code. That forced the product decisions before the technical
  ones.
- **Schema + types first, UI second.** Drizzle schema and the shared
  `@xeno/types` wire schemas came before any handler. The agent's tool
  definitions then derive directly from those types — one source of truth.
- **Two-pass review.** After every package, I ran `pnpm typecheck` and let
  the errors drive the next round. The first build surfaced a duplicate
  `ioredis` resolution between BullMQ and our app — fixed by pinning via
  `pnpm-workspace.yaml overrides`. That kind of cleanup is exactly what AI
  pair programming is good for.

## 4:55 — Tradeoffs note (~30 s)

> "I made every cut deliberately. The biggest: the agent loop runs in the
> request path with a 60 s timeout. At scale you'd push it to a background
> job. Full list is in `docs/tradeoffs.md`."

## 5:25 — Close (~10 s)

> "Code is at [GITHUB URL]. Hosted demo at [PRODUCTION URL]. Happy to walk
> through any of it live."
