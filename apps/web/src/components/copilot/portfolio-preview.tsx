'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconRocket,
  IconLoader2,
  IconCheck,
  IconUsers,
  IconTrendingUp,
  IconBrandWhatsapp,
  IconMail,
  IconMessageDots,
} from '@tabler/icons-react';
import type { CampaignPlan } from '@xeno/types';
import { cn } from '@/lib/cn';

type Portfolio = {
  goal: string;
  rationale: string;
  budget?: number;
  campaigns: Array<{ rationale: string; plan: CampaignPlan }>;
  portfolioEstimate?: {
    totalReach: number;
    expectedOrders: number;
    expectedRevenue: number;
  };
};

const channelIcon = {
  whatsapp: IconBrandWhatsapp,
  email: IconMail,
  sms: IconMessageDots,
  rcs: IconMessageDots,
} as const;

export function PortfolioPreview({ portfolio }: { portfolio: Portfolio }) {
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState<string[] | null>(null);
  const router = useRouter();

  async function shipAll() {
    setLaunching(true);
    try {
      const res = await fetch('/api/campaigns/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campaigns: portfolio.campaigns.map((c) => c.plan) }),
      });
      if (!res.ok) {
        alert(`Failed to ship portfolio: ${await res.text()}`);
        return;
      }
      const { results } = (await res.json()) as { results: Array<{ id?: string }> };
      const ids = results.map((r) => r.id).filter(Boolean) as string[];
      setLaunched(ids);
      if (ids[0]) {
        // Land them on the first campaign so they can see the funnel start moving.
        setTimeout(() => router.push(`/campaigns/${ids[0]}`), 1200);
      }
    } finally {
      setLaunching(false);
    }
  }

  return (
    <div className="surface-glow !p-0 overflow-hidden stream-in">
      {/* Portfolio header */}
      <div className="p-5 border-b border-border bg-white/[0.02]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="chip pill-cyan inline-flex !py-1 !px-2.5 mb-2.5">
              <IconRocket size={11} /> portfolio
            </div>
            <h2 className="text-2xl font-bold tracking-[-0.03em] max-w-xl">{portfolio.goal}</h2>
            <p className="text-[13.5px] text-ink-soft leading-6 mt-2 max-w-xl">
              {portfolio.rationale}
            </p>
          </div>
          {portfolio.portfolioEstimate && (
            <div className="surface !p-4 grid grid-cols-3 gap-4 min-w-[280px]">
              <PortfolioStat label="Reach" value={portfolio.portfolioEstimate.totalReach.toLocaleString('en-IN')} />
              <PortfolioStat label="Orders" value={`~${portfolio.portfolioEstimate.expectedOrders}`} />
              <PortfolioStat
                label="Revenue"
                value={`₹${(portfolio.portfolioEstimate.expectedRevenue / 1000).toFixed(0)}k`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Campaigns stack */}
      <div className="divide-y divide-border">
        {portfolio.campaigns.map((c, i) => (
          <CampaignCard
            key={i}
            index={i + 1}
            rationale={c.rationale}
            plan={c.plan}
            launchedId={launched?.[i]}
          />
        ))}
      </div>

      {/* Action footer */}
      <div className="border-t border-border bg-white/[0.02] px-5 py-4 flex items-center gap-2 flex-wrap">
        {launched ? (
          <div className="chip pill-lime !py-1.5 !px-3 inline-flex font-medium">
            <IconCheck size={12} /> {launched.length} campaigns shipped — opening the first one
          </div>
        ) : (
          <>
            <button
              onClick={shipAll}
              disabled={launching}
              className="btn-primary !py-2.5 !px-5 disabled:opacity-60"
              style={{ background: 'var(--grad-cyan)' }}
            >
              {launching ? (
                <IconLoader2 size={14} className="animate-spin" />
              ) : (
                <IconRocket size={14} />
              )}
              ship all {portfolio.campaigns.length}
            </button>
            <span className="text-xs text-ink-faint ml-1">
              or click any campaign above to inspect first
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function CampaignCard({
  index,
  rationale,
  plan,
  launchedId,
}: {
  index: number;
  rationale: string;
  plan: CampaignPlan;
  launchedId?: string;
}) {
  const Icon = channelIcon[plan.channelMix.primary];
  return (
    <div
      className={cn(
        'p-5 transition-all',
        launchedId && 'bg-success/[0.05]',
      )}
    >
      <div className="flex items-start gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-[80px]">
          <div className="text-3xl font-bold tracking-tighter text-white/15 tabular-nums">
            {String(index).padStart(2, '0')}
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon size={14} className="text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
              {plan.channelMix.primary}
              {plan.channelMix.fallback && (
                <> → {plan.channelMix.fallback}</>
              )}
            </span>
            {launchedId && (
              <span className="chip pill-lime !py-0 !px-1.5 !text-[10px]">
                <IconCheck size={10} /> shipped
              </span>
            )}
          </div>
          <div className="font-semibold text-[15px] tracking-tight">
            {plan.audience.description}
          </div>
          <p className="text-[13px] text-ink-soft leading-6">{rationale}</p>
          {plan.variants[0] && (
            <div className="bg-white/[0.04] border border-white/10 rounded-lg p-3 mt-2 text-[12.5px] leading-6 text-ink-soft line-clamp-2">
              {plan.variants[0].body}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 items-end min-w-[140px]">
          <span className="chip pill-violet font-semibold">
            <IconUsers size={11} />{' '}
            {(plan.estimate?.audienceSize ?? 0).toLocaleString('en-IN')}
          </span>
          {plan.estimate?.expectedOrders && (
            <span className="chip pill-lime font-semibold">
              <IconTrendingUp size={11} /> ~{plan.estimate.expectedOrders} orders
            </span>
          )}
          {plan.estimate?.expectedRevenue && (
            <span className="chip pill-amber font-semibold">
              ₹{(plan.estimate.expectedRevenue / 1000).toFixed(0)}k
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function PortfolioStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
        {label}
      </div>
      <div className="text-lg font-bold tracking-tight mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}
