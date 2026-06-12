import { sql, inArray } from 'drizzle-orm';
import { customers, db } from '@xeno/db';
import type { ChannelKind } from '@xeno/types';

export const proposeChannelMixSchema = {
  type: 'function',
  function: {
    name: 'propose_channel_mix',
    description:
      'Given an audience (by customer ids OR by the most-recent query_audience result), inspect opt-in rates and recommend a primary + optional fallback channel.',
    parameters: {
      type: 'object',
      properties: {
        customerIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'IDs from the most recent query_audience call.',
        },
      },
      required: ['customerIds'],
    },
  },
} as const;

export async function runProposeChannelMix(args: { customerIds: string[] }) {
  if (args.customerIds.length === 0) {
    return { primary: 'email' as ChannelKind, fallback: undefined, reason: 'empty audience' };
  }
  // Cap the inspection sample — opt-in distribution converges fast.
  const sample = args.customerIds.slice(0, 500);
  const rows = await db
    .select({
      total: sql<number>`count(*)::int`,
      wa: sql<number>`sum(case when ${customers.optInWhatsapp} then 1 else 0 end)::int`,
      em: sql<number>`sum(case when ${customers.optInEmail} then 1 else 0 end)::int`,
      sm: sql<number>`sum(case when ${customers.optInSms} then 1 else 0 end)::int`,
    })
    .from(customers)
    .where(inArray(customers.id, sample));
  const row = rows[0] ?? { total: 0, wa: 0, em: 0, sm: 0 };

  const rates: Record<'whatsapp' | 'email' | 'sms', number> = {
    whatsapp: row.wa / Math.max(1, row.total),
    email: row.em / Math.max(1, row.total),
    sms: row.sm / Math.max(1, row.total),
  };
  const ranked = (Object.entries(rates) as [ChannelKind, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([, r]) => r >= 0.05);

  const primary = (ranked[0]?.[0] ?? 'email') as ChannelKind;
  const fallback = ranked.find(([c]) => c !== primary)?.[0];
  const primaryRate =
    primary === 'whatsapp' || primary === 'email' || primary === 'sms' ? rates[primary] : 0;
  return {
    primary,
    fallback,
    fallbackAfterHours: 24,
    optInRates: {
      whatsapp: Number(rates.whatsapp.toFixed(2)),
      email: Number(rates.email.toFixed(2)),
      sms: Number(rates.sms.toFixed(2)),
    },
    reason: `Primary picked by highest opt-in (${primary}: ${(primaryRate * 100).toFixed(0)}%). ${
      fallback
        ? `Fallback to ${fallback} after 24 h if no engagement.`
        : 'No viable fallback (all others below 5% opt-in).'
    }`,
  };
}
