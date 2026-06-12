import Link from 'next/link';
import { db, customers, campaigns } from '@xeno/db';
import { sql, desc } from 'drizzle-orm';
import {
  IconSparkles,
  IconUsers,
  IconSend,
  IconActivity,
  IconTarget,
  IconArrowUpRight,
  IconBolt,
  IconRocket,
} from '@tabler/icons-react';
import { BriefInput } from '@/components/copilot/brief-input';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function loadKpis() {
  const [{ shoppers }] = await db.select({ shoppers: sql<number>`count(*)::int` }).from(customers);
  const [{ active }] = await db
    .select({ active: sql<number>`count(*) filter (where status in ('sending','scheduled'))::int` })
    .from(campaigns);
  const [{ sentToday }] = await db
    .select({
      sentToday: sql<number>`coalesce(sum(case when sent_at >= current_date then 1 else 0 end), 0)::int`,
    })
    .from(sql`communications`);
  const recent = await db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      status: campaigns.status,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt))
    .limit(5);
  return { shoppers, active, sentToday, recent };
}

const SUGGESTIONS = [
  "bring back shoppers who ghosted us 60+ days ago",
  "push the winter blend to VIPs in bengaluru",
  "save the cart abandoners from this week",
  "birthday squad — give them something nice",
];

const AUTOPILOT_SUGGESTIONS = [
  "get me 100 orders this week, ₹50k budget",
  "max revenue this weekend, no budget limit",
  "fill the funnel — anything to keep retention up",
];

export default async function Home() {
  const { shoppers, active, sentToday, recent } = await loadKpis();

  return (
    <div className="max-w-6xl mx-auto px-6 py-12 space-y-12">
      <div className="reveal reveal-1 grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={IconUsers}
          accent="var(--grad-violet)"
          label="Shoppers"
          value={shoppers.toLocaleString('en-IN')}
          trend="+12%"
        />
        <Kpi
          icon={IconActivity}
          accent="var(--grad-cyan)"
          label="Live campaigns"
          value={String(active)}
        />
        <Kpi
          icon={IconSend}
          accent="var(--grad-warm)"
          label="Sent today"
          value={sentToday.toLocaleString('en-IN')}
        />
        <Kpi
          icon={IconTarget}
          accent="var(--grad-lime)"
          label="Reply rate · 7d"
          value="6.2%"
          trend="+0.8"
        />
      </div>

      {/* Brief hero */}
      <section className="reveal reveal-2 space-y-6">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="chip pill-violet inline-flex !py-1.5 !px-3 font-medium">
            <IconSparkles size={12} /> brief the copilot
          </div>
          <div className="chip !py-1 !px-2 text-[11px] inline-flex !gap-1">
            <IconBolt size={10} className="text-amber-400" />
            sub-second
          </div>
        </div>
        <div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]">
            what should we ship
            <br />
            <span className="text-gradient italic">today?</span>
          </h1>
          <p className="text-[15px] text-ink-soft max-w-2xl mt-4 leading-relaxed">
            drop a goal in plain english — find the audience, draft the message, pick the channel,
            send. all of it.
          </p>
        </div>
        <BriefInput suggestions={SUGGESTIONS} mode="plan" />
      </section>

      {/* Autopilot hero */}
      <section className="reveal reveal-3 space-y-5">
        <div className="surface-glow p-6 md:p-8 relative overflow-hidden">
          <div
            className="absolute -top-32 -right-32 w-72 h-72 rounded-full opacity-30 blur-3xl"
            style={{ background: 'var(--grad-cyan)' }}
          />
          <div className="relative space-y-5">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="chip pill-cyan inline-flex !py-1.5 !px-3 font-medium">
                <IconRocket size={12} /> autopilot
              </div>
              <div className="chip !py-1 !px-2 text-[11px] inline-flex !gap-1">
                portfolio mode · runs 2–4 campaigns
              </div>
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.04em] leading-[1.05]">
                or just set a goal.
                <br />
                <span className="text-gradient-cyan italic">let the agent figure it out.</span>
              </h2>
              <p className="text-[14.5px] text-ink-soft max-w-2xl mt-3 leading-relaxed">
                give it a number and a deadline. it&apos;ll decompose the goal into a portfolio of
                campaigns and run all of them.
              </p>
            </div>
            <BriefInput
              suggestions={AUTOPILOT_SUGGESTIONS}
              mode="autopilot"
              placeholder="e.g. get 100 orders this week, ₹50k budget"
            />
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="reveal reveal-4 space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-widest">
              Recent campaigns
            </h2>
            <Link
              href="/campaigns"
              className="text-xs text-violet-300 hover:text-violet-200 inline-flex items-center gap-1 transition-colors"
            >
              See all <IconArrowUpRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {recent.map((c) => (
              <Link
                key={c.id}
                href={`/campaigns/${c.id}`}
                className="surface block px-5 py-4 glow-hover group"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-ink-faint mt-0.5">
                      {new Date(c.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={c.status} />
                    <IconArrowUpRight
                      size={14}
                      className="text-ink-faint group-hover:text-ink group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all"
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon,
  accent,
  label,
  value,
  trend,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  label: string;
  value: string;
  trend?: string;
}) {
  return (
    <div className="surface relative overflow-hidden p-5 group hover:border-white/20 transition-all">
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-25 blur-2xl group-hover:opacity-50 transition-opacity"
        style={{ background: accent }}
      />
      <div className="relative">
        <div className="flex items-center justify-between text-ink-soft">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider">
            <Icon size={13} />
            <span>{label}</span>
          </div>
          {trend && (
            <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded-md border border-success/20">
              {trend}
            </span>
          )}
        </div>
        <div className="text-[28px] font-bold tracking-tight mt-2 tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'completed'
      ? 'pill-lime'
      : status === 'sending'
        ? 'pill-violet'
        : status === 'failed'
          ? 'pill-pink'
          : '';
  return (
    <span className={`chip ${cls}`}>
      {status === 'sending' && <span className="dot-live !w-1.5 !h-1.5" />}
      {status}
    </span>
  );
}
