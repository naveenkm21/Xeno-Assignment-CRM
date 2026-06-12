'use client';
import useSWR from 'swr';
import { useEffect, useState } from 'react';
import { IconSparkles, IconLoader2, IconActivity } from '@tabler/icons-react';
import { cn } from '@/lib/cn';

type Stats = {
  funnel: Record<string, number>;
  perChannel: Record<string, { sent: number; delivered: number; converted: number }>;
  perVariant: Record<string, { sent: number; converted: number }>;
  recentEvents: Array<{
    commId: string;
    state: string;
    occurredAt: string;
    meta: Record<string, string | number | boolean> | null;
  }>;
  revenue: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FUNNEL_ORDER = ['queued', 'sent', 'delivered', 'opened', 'clicked', 'converted'] as const;

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: 'bg-[#4ADE80]',
  email: 'bg-[#22D3EE]',
  sms: 'bg-[#FB923C]',
  rcs: 'bg-[#A78BFA]',
};

export function CampaignMonitor({ campaignId, status }: { campaignId: string; status: string }) {
  const { data: stats } = useSWR<Stats>(`/api/campaigns/${campaignId}/stats`, fetcher, {
    refreshInterval: status === 'sending' ? 1500 : 0,
  });

  return (
    <div className="space-y-8">
      <FunnelSection funnel={stats?.funnel} isLive={status === 'sending'} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChannelSplit perChannel={stats?.perChannel} />
        <VariantSplit perVariant={stats?.perVariant} />
      </div>
      <EventLog events={stats?.recentEvents ?? []} isLive={status === 'sending'} />
      <InsightsSection campaignId={campaignId} status={status} stats={stats} />
    </div>
  );
}

function FunnelSection({
  funnel,
  isLive,
}: {
  funnel?: Record<string, number>;
  isLive: boolean;
}) {
  const queued = funnel?.queued ?? 0;
  return (
    <section>
      <SectionLabel icon={<IconActivity size={12} />}>Lifecycle funnel</SectionLabel>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-3">
        {FUNNEL_ORDER.map((stage, i) => {
          const count = funnel?.[stage] ?? 0;
          const pct = queued > 0 ? (count / queued) * 100 : 0;
          const showLive = isLive && i > 0 && i < 4;
          return (
            <div key={stage} className="surface p-4 relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-30 -z-0"
                style={{
                  background: 'var(--grad-violet)',
                  clipPath: `inset(${100 - pct}% 0 0 0)`,
                }}
              />
              <div className="relative">
                <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-widest capitalize flex items-center gap-1.5">
                  {stage}
                  {showLive && <span className="dot-live !w-1 !h-1" />}
                </div>
                <div className="text-[26px] font-bold tracking-tight mt-1 tabular-nums">
                  {count.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ChannelSplit({
  perChannel,
}: {
  perChannel?: Record<string, { sent: number; delivered: number; converted: number }>;
}) {
  if (!perChannel) return null;
  const entries = Object.entries(perChannel);
  const total = entries.reduce((s, [, v]) => s + v.sent, 0) || 1;
  return (
    <section className="surface p-5">
      <SectionLabel>Channel split · sent</SectionLabel>
      <div className="flex h-2.5 rounded-full overflow-hidden mt-3 bg-white/[0.04]">
        {entries.map(([c, v]) => (
          <div
            key={c}
            className={cn(CHANNEL_COLOR[c] ?? 'bg-white/30', 'transition-all duration-500')}
            style={{ width: `${(v.sent / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 text-xs text-ink-soft">
        {entries.map(([c, v]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-sm', CHANNEL_COLOR[c] ?? 'bg-white/30')} />
            <span className="font-medium capitalize">{c}</span>
            <span className="tabular-nums text-ink-faint">
              {Math.round((v.sent / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

function VariantSplit({
  perVariant,
}: {
  perVariant?: Record<string, { sent: number; converted: number }>;
}) {
  if (!perVariant) return null;
  const entries = Object.entries(perVariant);
  const best = entries.reduce<[string, number]>(
    (a, [k, v]) => (v.converted > a[1] ? [k, v.converted] : a),
    ['', 0],
  );
  return (
    <section className="surface p-5">
      <SectionLabel>Variant performance</SectionLabel>
      <div className="space-y-3 mt-3">
        {entries.map(([v, stats]) => {
          const rate = stats.sent > 0 ? (stats.converted / stats.sent) * 100 : 0;
          const isWinner = v === best[0] && best[1] > 0;
          return (
            <div key={v}>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-medium flex items-center gap-1.5">
                  Variant {v}
                  {isWinner && (
                    <span className="chip pill-lime !py-0 !px-1.5 !text-[10px]">winning</span>
                  )}
                </span>
                <span className="tabular-nums text-ink-soft">
                  {stats.converted}/{stats.sent} · {rate.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.04] overflow-hidden">
                <div
                  className={cn('h-full transition-all duration-500')}
                  style={{
                    width: `${Math.max(2, rate * 8)}%`,
                    background: isWinner ? 'var(--grad-lime)' : 'rgba(255,255,255,0.25)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function EventLog({
  events,
  isLive,
}: {
  events: Stats['recentEvents'];
  isLive: boolean;
}) {
  return (
    <section>
      <SectionLabel>
        Channel-service callbacks
        {isLive && (
          <span className="ml-2 inline-flex items-center gap-1 text-success normal-case tracking-normal text-[10px]">
            <span className="dot-live !w-1.5 !h-1.5" /> live
          </span>
        )}
      </SectionLabel>
      <div className="surface mt-3 p-4 font-mono text-[12px] leading-relaxed text-ink-soft max-h-72 overflow-auto scrollbar-thin">
        {events.length === 0 ? (
          <div className="text-ink-faint">waiting for first event…</div>
        ) : (
          events.map((e, i) => (
            <div key={`${e.commId}-${e.state}-${i}`} className="stream-in py-0.5">
              <span className="text-ink-faint">
                {new Date(e.occurredAt).toLocaleTimeString('en-IN', { hour12: false })}
              </span>{' '}
              <span
                className={cn(
                  'font-semibold',
                  e.state === 'failed' || e.state === 'bounced'
                    ? 'text-danger'
                    : e.state === 'converted' || e.state === 'clicked'
                      ? 'text-success'
                      : 'text-violet-300',
                )}
              >
                {e.state}
              </span>{' '}
              <span className="text-ink-faint">comm={e.commId.slice(0, 8)}</span>
              {e.meta?.reason && (
                <span className="text-danger"> · {String(e.meta.reason)}</span>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InsightsSection({
  campaignId,
  status,
  stats,
}: {
  campaignId: string;
  status: string;
  stats?: Stats;
}) {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'sending' || summary) return;
    setLoading(true);
    fetch(`/api/campaigns/${campaignId}/summary`)
      .then((r) => r.json())
      .then((d) => setSummary(d.summary ?? null))
      .finally(() => setLoading(false));
  }, [campaignId, status, summary]);

  if (status === 'sending') return null;

  return (
    <section>
      <div className="surface-glow p-7 relative overflow-hidden">
        <div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-30 blur-3xl"
          style={{ background: 'var(--grad-hero)' }}
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'var(--grad-violet)' }}
            >
              <IconSparkles size={14} className="text-white" />
            </div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-violet-300">
              Copilot summary
            </span>
          </div>
          <div className="text-[15px] leading-7 whitespace-pre-wrap">
            {loading ? (
              <span className="flex items-center gap-2 text-ink-soft">
                <IconLoader2 size={14} className="animate-spin" /> generating…
              </span>
            ) : (
              summary ?? '—'
            )}
          </div>
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
              <Metric label="Orders" value={(stats.funnel.converted ?? 0).toLocaleString('en-IN')} />
              <Metric
                label="Revenue"
                value={`₹${(stats.revenue ?? 0).toLocaleString('en-IN')}`}
              />
              <Metric
                label="CTR"
                value={`${pct(stats.funnel.clicked ?? 0, stats.funnel.delivered ?? 0)}%`}
              />
              <Metric
                label="Convert rate"
                value={`${pct(stats.funnel.converted ?? 0, stats.funnel.delivered ?? 0)}%`}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function pct(num: number, denom: number) {
  if (!denom) return '0.0';
  return ((num / denom) * 100).toFixed(1);
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-widest">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function SectionLabel({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft flex items-center gap-1.5">
      {icon}
      {children}
    </div>
  );
}
