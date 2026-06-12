'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconBrandWhatsapp,
  IconMail,
  IconMessageDots,
  IconSend,
  IconEdit,
  IconRefresh,
  IconLoader2,
  IconUsers,
  IconCalendar,
  IconChartBar,
  IconTrendingUp,
} from '@tabler/icons-react';
import type { CampaignPlan } from '@xeno/types';

const channelIcon = {
  whatsapp: IconBrandWhatsapp,
  email: IconMail,
  sms: IconMessageDots,
  rcs: IconMessageDots,
} as const;

export function PlanPreview({ plan }: { plan: CampaignPlan }) {
  const [approving, setApproving] = useState(false);
  const router = useRouter();

  async function approve() {
    setApproving(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Failed to launch campaign: ${msg}`);
        return;
      }
      const { id } = await res.json();
      router.push(`/campaigns/${id}`);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="surface-raised !p-0 overflow-hidden stream-in">
      <Row icon={IconUsers} label="Audience">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip pill-violet !py-1 !px-2.5 font-semibold">
            {plan.estimate?.audienceSize?.toLocaleString('en-IN') ?? '—'} shoppers
          </span>
          <span className="text-[13px] text-ink-soft">{plan.audience.description}</span>
        </div>
      </Row>

      <Row icon={IconBrandWhatsapp} label="Variants">
        <div className="space-y-2.5">
          {plan.variants.map((v) => {
            const Icon = channelIcon[v.channel];
            return (
              <div
                key={`${v.channel}-${v.variantTag}`}
                className="bg-white/[0.03] border border-white/10 rounded-xl p-4 space-y-2 hover:border-white/20 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium uppercase tracking-wider">
                    <Icon size={13} className="text-violet-300" />
                    {v.channel} · variant {v.variantTag}
                  </span>
                  <button
                    className="text-ink-faint hover:text-ink flex items-center gap-1 transition-colors"
                    type="button"
                  >
                    <IconRefresh size={11} /> regenerate
                  </button>
                </div>
                {v.subject && (
                  <div className="text-[13.5px] font-semibold tracking-tight">{v.subject}</div>
                )}
                <div className="text-[13.5px] leading-7 whitespace-pre-wrap text-ink-soft">
                  {v.body}
                </div>
              </div>
            );
          })}
        </div>
      </Row>

      <Row icon={IconChartBar} label="Channel mix">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip pill-cyan !py-1 !px-2.5 font-semibold">
            primary · {plan.channelMix.primary}
          </span>
          {plan.channelMix.fallback && (
            <span className="chip">
              fallback · {plan.channelMix.fallback} after {plan.channelMix.fallbackAfterHours}h
            </span>
          )}
        </div>
      </Row>

      <Row icon={IconCalendar} label="Send window">
        <span className="chip pill-amber !py-1 !px-2.5 font-semibold">
          {plan.sendWindow.sendAt === 'now' ? 'send now' : plan.sendWindow.sendAt}
        </span>
      </Row>

      {plan.estimate && (
        <Row icon={IconTrendingUp} label="Estimate">
          <div className="text-[13px] text-ink-soft flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink tabular-nums">
              ~{plan.estimate.expectedOrders ?? '—'} orders
            </span>
            <span className="text-ink-faint">·</span>
            <span className="tabular-nums">
              ₹{plan.estimate.expectedRevenue?.toLocaleString('en-IN') ?? '—'}
            </span>
            <span className="chip !text-[10px] !py-0.5">
              {plan.estimate.confidence} confidence
            </span>
          </div>
        </Row>
      )}

      <div className="border-t border-border bg-white/[0.02] px-5 py-4 flex items-center gap-2 flex-wrap">
        <button
          onClick={approve}
          disabled={approving}
          className="btn-primary !py-2.5 !px-5 disabled:opacity-60"
        >
          {approving ? (
            <IconLoader2 size={14} className="animate-spin" />
          ) : (
            <IconSend size={14} />
          )}
          ship it
        </button>
        <button className="btn-secondary !py-2.5 !px-5" type="button">
          <IconEdit size={13} /> edit audience
        </button>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4 px-5 py-4 border-b border-border last:border-b-0">
      <div className="w-28 flex items-start gap-2 text-[10px] font-semibold text-ink-soft uppercase tracking-widest pt-1.5 flex-shrink-0">
        <Icon size={12} className="text-ink-faint mt-0.5" />
        {label}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
