'use client';
import useSWR from 'swr';
import Link from 'next/link';
import {
  IconShoppingBag,
  IconMail,
  IconBrandWhatsapp,
  IconMessageDots,
  IconCheck,
  IconX,
  IconEye,
  IconMouse,
  IconTrendingUp,
  IconMapPin,
  IconLoader2,
} from '@tabler/icons-react';
import { cn } from '@/lib/cn';

type Detail = {
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    city: string;
    optInWhatsapp: boolean;
    optInEmail: boolean;
    optInSms: boolean;
    tags: string[];
    createdAt: string;
  };
  stats: {
    ltv: number;
    orderCount: number;
    avgOrderValue: number;
    lastOrderAt: string | null;
    totalComms: number;
    opened: number;
    clicked: number;
    converted: number;
    openRate: number;
    ctr: number;
  };
  orders: Array<{
    id: string;
    total: string;
    itemCount: number;
    channelOrigin: string;
    placedAt: string;
    attributedCampaignId: string | null;
  }>;
  communications: Array<{
    id: string;
    campaignId: string;
    channel: 'whatsapp' | 'email' | 'sms' | 'rcs';
    variantTag: string;
    body: string;
    subject: string | null;
    state: string;
    sentAt: string | null;
    lastEventAt: string | null;
    attributedOrderId: string | null;
    failureReason: string | null;
    createdAt: string;
    campaignName: string | null;
  }>;
  events: Array<{
    id: string;
    commId: string;
    state: string;
    occurredAt: string;
    meta: Record<string, string | number | boolean> | null;
  }>;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const channelIcon = {
  whatsapp: IconBrandWhatsapp,
  email: IconMail,
  sms: IconMessageDots,
  rcs: IconMessageDots,
} as const;

export function CustomerInspector({ customerId }: { customerId: string }) {
  const { data, isLoading } = useSWR<Detail>(`/api/customers/${customerId}`, fetcher);

  if (isLoading || !data) {
    return (
      <div className="surface p-12 flex items-center justify-center text-ink-soft">
        <IconLoader2 size={18} className="animate-spin mr-2" /> loading shopper…
      </div>
    );
  }

  const { customer, stats, orders, communications, events } = data;

  // Merge orders + comms + events into one chronological timeline.
  type TimelineItem =
    | { type: 'order'; at: Date; data: Detail['orders'][number] }
    | { type: 'comm'; at: Date; data: Detail['communications'][number] }
    | { type: 'event'; at: Date; data: Detail['events'][number]; comm?: Detail['communications'][number] };

  const items: TimelineItem[] = [];
  for (const o of orders) items.push({ type: 'order', at: new Date(o.placedAt), data: o });
  for (const c of communications)
    items.push({ type: 'comm', at: new Date(c.createdAt), data: c });
  for (const e of events) {
    const parent = communications.find((c) => c.id === e.commId);
    items.push({ type: 'event', at: new Date(e.occurredAt), data: e, comm: parent });
  }
  items.sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div className="space-y-7">
      <ProfileCard customer={customer} stats={stats} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniKpi label="LTV" value={`₹${Math.round(stats.ltv).toLocaleString('en-IN')}`} />
        <MiniKpi label="Orders" value={String(stats.orderCount)} />
        <MiniKpi label="AOV" value={`₹${Math.round(stats.avgOrderValue).toLocaleString('en-IN')}`} />
        <MiniKpi
          label="Open rate"
          value={stats.totalComms ? `${Math.round(stats.openRate * 100)}%` : '—'}
        />
      </div>

      <section>
        <div className="text-[11px] font-semibold uppercase tracking-widest text-ink-soft mb-4">
          Lifetime timeline · {items.length} events
        </div>
        <Timeline items={items} />
      </section>
    </div>
  );
}

function ProfileCard({
  customer,
  stats,
}: {
  customer: Detail['customer'];
  stats: Detail['stats'];
}) {
  const colors = ['var(--grad-violet)', 'var(--grad-cyan)', 'var(--grad-warm)', 'var(--grad-lime)'];
  const idx = (customer.firstName.charCodeAt(0) + customer.lastName.charCodeAt(0)) % colors.length;
  return (
    <div className="surface-raised p-6 relative overflow-hidden">
      <div
        className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-25 blur-3xl"
        style={{ background: colors[idx] }}
      />
      <div className="relative flex items-start gap-5 flex-wrap">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center font-bold text-xl text-white shadow-md"
          style={{ background: colors[idx] }}
        >
          {(customer.firstName[0] ?? '') + (customer.lastName[0] ?? '')}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-[-0.035em]">
            {customer.firstName} {customer.lastName}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft mt-2">
            <span className="flex items-center gap-1">
              <IconMapPin size={13} /> {customer.city}
            </span>
            {customer.email && <span className="truncate max-w-[260px]">{customer.email}</span>}
            {customer.phone && <span>{customer.phone}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <OptInChip channel="whatsapp" optedIn={customer.optInWhatsapp} />
            <OptInChip channel="email" optedIn={customer.optInEmail} />
            <OptInChip channel="sms" optedIn={customer.optInSms} />
            {customer.tags.map((t) => (
              <span key={t} className="chip">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right space-y-1">
          <div className="text-[10px] uppercase tracking-widest text-ink-soft">Last seen</div>
          <div className="text-sm font-medium">
            {stats.lastOrderAt
              ? new Date(stats.lastOrderAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '—'}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptInChip({
  channel,
  optedIn,
}: {
  channel: 'whatsapp' | 'email' | 'sms';
  optedIn: boolean;
}) {
  const Icon = channelIcon[channel];
  return (
    <span
      className={cn(
        'chip text-[11px]',
        optedIn ? 'pill-lime' : 'opacity-50 line-through',
      )}
    >
      <Icon size={11} /> {channel}
    </span>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface p-4">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-ink-soft">
        {label}
      </div>
      <div className="text-2xl font-bold tracking-tight mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Timeline({
  items,
}: {
  items: Array<
    | { type: 'order'; at: Date; data: Detail['orders'][number] }
    | { type: 'comm'; at: Date; data: Detail['communications'][number] }
    | { type: 'event'; at: Date; data: Detail['events'][number]; comm?: Detail['communications'][number] }
  >;
}) {
  if (items.length === 0) {
    return (
      <div className="surface p-8 text-center text-sm text-ink-soft">
        no activity yet — this shopper hasn&apos;t ordered or received any comms.
      </div>
    );
  }
  return (
    <div className="relative">
      <div className="absolute left-[15px] top-3 bottom-3 w-px bg-border" />
      <div className="space-y-3">
        {items.map((item, i) => (
          <TimelineRow key={`${item.type}-${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function TimelineRow({
  item,
}: {
  item:
    | { type: 'order'; at: Date; data: Detail['orders'][number] }
    | { type: 'comm'; at: Date; data: Detail['communications'][number] }
    | { type: 'event'; at: Date; data: Detail['events'][number]; comm?: Detail['communications'][number] };
}) {
  const when = item.at.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (item.type === 'order') {
    return (
      <div className="flex items-start gap-3 stream-in">
        <Marker accent="var(--grad-lime)" icon={IconShoppingBag} />
        <div className="surface flex-1 p-4 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="font-semibold text-[15px] tabular-nums">
              ₹{Number(item.data.total).toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-ink-faint">{when}</div>
          </div>
          <div className="text-xs text-ink-soft mt-1 flex items-center gap-2">
            <span>
              {item.data.itemCount} item{item.data.itemCount === 1 ? '' : 's'}
            </span>
            <span>·</span>
            <span>via {item.data.channelOrigin}</span>
            {item.data.attributedCampaignId && (
              <>
                <span>·</span>
                <Link
                  href={`/campaigns/${item.data.attributedCampaignId}`}
                  className="text-violet-300 hover:text-violet-200 inline-flex items-center gap-1"
                >
                  attributed to campaign
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (item.type === 'comm') {
    const Icon = channelIcon[item.data.channel];
    return (
      <div className="flex items-start gap-3 stream-in">
        <Marker accent="var(--grad-violet)" icon={Icon} />
        <div className="surface flex-1 p-4 hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-ink-soft font-semibold">
              <span>{item.data.channel}</span>
              <span>·</span>
              <span>variant {item.data.variantTag}</span>
              <StateBadge state={item.data.state} />
            </div>
            <div className="text-xs text-ink-faint">{when}</div>
          </div>
          {item.data.subject && (
            <div className="text-[13.5px] font-semibold mt-2">{item.data.subject}</div>
          )}
          <div className="text-[13px] text-ink-soft leading-6 mt-1.5 line-clamp-3">
            {item.data.body}
          </div>
          {item.data.campaignName && (
            <Link
              href={`/campaigns/${item.data.campaignId}`}
              className="text-[11px] text-violet-300 hover:text-violet-200 mt-2 inline-flex items-center gap-1"
            >
              part of: {item.data.campaignName}
            </Link>
          )}
        </div>
      </div>
    );
  }

  // event
  const stateIcon = stateToIcon(item.data.state);
  const tone = stateToTone(item.data.state);
  return (
    <div className="flex items-start gap-3 stream-in">
      <Marker accent={tone.bg} icon={stateIcon} small />
      <div className="flex-1 px-3 py-2 text-xs text-ink-soft flex items-center gap-2 flex-wrap">
        <span className={cn('font-semibold capitalize', tone.text)}>{item.data.state}</span>
        {item.comm && (
          <span className="text-ink-faint">
            on {item.comm.channel} · variant {item.comm.variantTag}
          </span>
        )}
        {item.data.meta?.reason && (
          <span className="text-danger">· {String(item.data.meta.reason)}</span>
        )}
        <span className="text-ink-faint ml-auto">{when}</span>
      </div>
    </div>
  );
}

function Marker({
  accent,
  icon: Icon,
  small,
}: {
  accent: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  small?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl flex items-center justify-center shadow-sm border border-white/10 flex-shrink-0 z-10',
        small ? 'w-7 h-7 ml-1' : 'w-8 h-8',
      )}
      style={{ background: accent }}
    >
      <Icon size={small ? 12 : 14} className="text-white" />
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const tone = stateToTone(state);
  return <span className={cn('chip !py-0 !px-1.5 !text-[10px]', tone.pill)}>{state}</span>;
}

function stateToTone(state: string): { pill: string; text: string; bg: string } {
  switch (state) {
    case 'converted':
      return { pill: 'pill-lime', text: 'text-success', bg: 'var(--grad-lime)' };
    case 'clicked':
      return { pill: 'pill-cyan', text: 'text-cyan-300', bg: 'var(--grad-cyan)' };
    case 'opened':
      return { pill: 'pill-violet', text: 'text-violet-300', bg: 'var(--grad-violet)' };
    case 'delivered':
      return { pill: '', text: 'text-ink', bg: 'rgba(255,255,255,0.15)' };
    case 'sent':
      return { pill: '', text: 'text-ink', bg: 'rgba(255,255,255,0.1)' };
    case 'failed':
    case 'bounced':
      return { pill: 'pill-pink', text: 'text-danger', bg: 'var(--grad-warm)' };
    default:
      return { pill: '', text: 'text-ink-soft', bg: 'rgba(255,255,255,0.1)' };
  }
}

function stateToIcon(state: string) {
  switch (state) {
    case 'converted':
      return IconTrendingUp;
    case 'clicked':
      return IconMouse;
    case 'opened':
      return IconEye;
    case 'delivered':
      return IconCheck;
    case 'failed':
    case 'bounced':
      return IconX;
    default:
      return IconCheck;
  }
}
