# Xeno Copilot

An AI-native mini CRM. Marketers tell a copilot what they want — _"bring back
customers who haven't ordered in 60 days"_ — and the agent proposes the
audience, drafts channel-specific messages, picks the channel mix, sends, and
narrates the results.

Built as a take-home for Xeno's 2026 engineering internship. The full design
rationale is in [`docs/architecture.md`](docs/architecture.md) and the explicit
scale tradeoffs are in [`docs/tradeoffs.md`](docs/tradeoffs.md).

## The opinionated bet

A **chat-first agentic CRM**. The four flavours of "AI-native" the brief
mentions sit on a spectrum from _AI-as-helper_ to _AI-as-agent_; this build
commits to the agent end. The classic CRM surfaces (audiences, campaigns,
insights) exist as inspect-and-edit panels behind the conversation, not as the
primary workflow. You can't _not_ talk to the copilot.

## Architecture at a glance

Two services, callback-driven — exactly the shape the brief asks for.

```
              ┌────────────────────────────────┐         ┌───────────────────┐
  marketer ──►│  Xeno Copilot (Next.js)        │ POST    │  Channel stub     │
              │  • chat UI · Clerk auth        │ /send   │  (Express + Bull) │
              │  • copilot agent (Groq Llama)  ├────────►│  • simulates      │
              │  • audience / campaign API     │         │    delivery       │
              │  • receipt ingester (idempot.) │◄────────┤  • async callback │
              └──────┬─────────────────────────┘  POST   │  • HMAC signed    │
                     │                          /receipt └───────────────────┘
              Neon Postgres        Upstash Redis (BullMQ)
```

The receipt ingester is the system-design centrepiece — idempotent by
`(comm_id, state, occurred_at)`, lifecycle-ranked so late events can't regress
state, batched campaign-completion check, signed via HMAC-SHA256 on every
callback.

## Repo layout

```
apps/
  web/          Next.js 15 (App Router) — UI + CRM API routes
  channel/      Express channel-stub — separate deployable
packages/
  db/           Drizzle ORM schema, migrations, seed (shared)
  ai/           Groq client, agent loop, tool definitions, prompts
  types/        Shared TypeScript types & zod wire schemas
docs/
  architecture.md   How it fits together and why
  tradeoffs.md      Scale assumptions + what changes at 10× and 100×
  walkthrough.md    Script for the 5-min demo video
```

## Stack — entirely free tier

| Layer        | Pick                                                          |
| ------------ | ------------------------------------------------------------- |
| LLM          | Groq · `llama-3.3-70b-versatile` (plan) + `llama-3.1-8b-instant` (draft) |
| Auth         | Clerk free tier                                               |
| Postgres     | Neon free                                                     |
| Queue        | Upstash Redis free + BullMQ                                   |
| Web hosting  | Vercel hobby                                                  |
| Channel host | Fly.io free tier (always-on small VM — no cold start mid-demo)|

## Running locally

Prerequisites: Node 22, pnpm 10, a Neon database URL, a Groq API key, a Clerk
test instance, an Upstash Redis URL.

```bash
# 1. Install deps
pnpm install

# 2. Configure env
cp .env.example .env
# then fill in DATABASE_URL, GROQ_API_KEY, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
# CLERK_SECRET_KEY, REDIS_URL, CHANNEL_WEBHOOK_SECRET (long random string)

# 3. Push the schema and seed Aroma Coffee data (~5k shoppers, 30k orders)
pnpm db:push
pnpm db:seed

# 4. Run both services in parallel
pnpm dev
# → web app  http://localhost:3000
# → channel  http://localhost:4000

# Sign up via Clerk, then click any suggestion on the home page to brief the
# copilot. The agent loop streams its trace into the chat.
```

## Deploying

The two services deploy independently. Both halves need the same `.env` to be
present in their respective dashboards.

### Web → Vercel

```bash
# from the repo root
vercel link            # link to a project
vercel env add ...     # add every var from .env.example
vercel --prod
```

Vercel auto-detects Next.js. The `apps/web/vercel.json` already pins
`maxDuration` on the agent route to 60 s.

### Channel → Fly.io

```bash
cd apps/channel
fly launch --no-deploy --copy-config   # creates xeno-channel-stub
fly secrets set REDIS_URL=... WEB_BASE_URL=https://your-vercel.app CHANNEL_WEBHOOK_SECRET=...
fly deploy
```

Then set `CHANNEL_BASE_URL` in Vercel to your Fly app URL.

## Verifying it works end-to-end

1. Hit the home page, sign in.
2. Click "Win back lapsed customers" (or type any goal).
3. Watch the agent trace stream — should see `query_audience` → `draft_message`
   → `propose_channel_mix` → `finalize_plan` chips fill in.
4. Click **Approve & send** on the plan preview.
5. Land on `/campaigns/[id]` — funnel and event log update every 2 s.
6. Wait ~45 s. Status flips to **completed**, the copilot summary appears with
   winning channel + variant + revenue.

## What I deliberately didn't build

- No drag-and-drop journey builder. The chat is the builder.
- No template library. The copilot drafts fresh; winners get surfaced in
  insights but aren't saved as templates yet.
- No multi-tenant. One brand ("Aroma Coffee Co."), one user role. Clerk
  organizations would slot in but don't reveal anything about the agent
  design.
- No real channel providers. The brief explicitly asks for the stub — see
  [`docs/architecture.md`](docs/architecture.md) on how a Twilio/Karix adapter
  would slot in.
- No statistical significance on variant lift. At demo audience sizes most
  tests wouldn't be significant — calling it out is more honest than faking
  p-values.

The full list with reasoning is in [`docs/tradeoffs.md`](docs/tradeoffs.md).

## Scripts

| Script | What it does |
| ------ | ------------ |
| `pnpm dev` | Both apps in parallel |
| `pnpm dev:web` / `pnpm dev:channel` | One side only |
| `pnpm build` | Build everything |
| `pnpm typecheck` | TS across all workspaces |
| `pnpm db:push` | Apply schema to Neon |
| `pnpm db:seed` | Seed Aroma Coffee data |
| `pnpm db:studio` | Open Drizzle Studio against your Neon DB |

## License

Take-home submission — not for redistribution.
