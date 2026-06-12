import { and, eq, inArray, sql } from 'drizzle-orm';
import { db, customers, orders } from '@xeno/db';
import { audienceFilterSchema, type AudienceFilter, type ChannelKind } from '@xeno/types';

/**
 * Materialize an AudienceFilter into the actual list of customer IDs that
 * should receive a campaign. Mirrors the runQueryAudience tool but returns
 * IDs rather than a count + sample. Also filters by channel opt-in so we
 * never send to someone who hasn't agreed.
 */
export async function materializeAudience(
  filter: AudienceFilter,
  primaryChannel: ChannelKind,
): Promise<string[]> {
  const parsed = audienceFilterSchema.parse(filter);

  const customerConds = [];
  type AggCond = { field: string; op: string; value: unknown };
  const aggConds: AggCond[] = [];

  for (const r of parsed.rules) {
    if (
      r.field === 'last_order_at' ||
      r.field === 'order_count' ||
      r.field === 'lifetime_value' ||
      r.field === 'avg_order_value'
    ) {
      aggConds.push(r);
      continue;
    }
    if (r.field === 'city') {
      if (r.op === 'eq') customerConds.push(eq(customers.city, String(r.value)));
      if (r.op === 'in' && Array.isArray(r.value))
        customerConds.push(inArray(customers.city, r.value.map(String)));
    }
    if (r.field === 'opt_in_whatsapp' && r.op === 'eq')
      customerConds.push(eq(customers.optInWhatsapp, Boolean(r.value)));
    if (r.field === 'opt_in_email' && r.op === 'eq')
      customerConds.push(eq(customers.optInEmail, Boolean(r.value)));
    if (r.field === 'opt_in_sms' && r.op === 'eq')
      customerConds.push(eq(customers.optInSms, Boolean(r.value)));
  }

  // Hard rule: enforce channel opt-in. The agent should also be doing this
  // but enforcing it here means we never accidentally send to someone who
  // unsubscribed since the filter was authored.
  if (primaryChannel === 'whatsapp') customerConds.push(eq(customers.optInWhatsapp, true));
  if (primaryChannel === 'email') customerConds.push(eq(customers.optInEmail, true));
  if (primaryChannel === 'sms') customerConds.push(eq(customers.optInSms, true));

  const having = aggConds.map((c) => {
    const colExpr =
      c.field === 'last_order_at'
        ? sql<Date>`max(${orders.placedAt})`
        : c.field === 'order_count'
          ? sql<number>`count(${orders.id})`
          : c.field === 'lifetime_value'
            ? sql<number>`coalesce(sum(${orders.total}), 0)`
            : sql<number>`coalesce(avg(${orders.total}), 0)`;
    const value =
      c.field === 'last_order_at' && typeof c.value === 'number' && c.value < 0
        ? sql`now() - interval '${sql.raw(String(Math.abs(c.value)))} days'`
        : c.field === 'last_order_at'
          ? sql`${c.value as string}::timestamptz`
          : sql`${c.value as number}`;
    switch (c.op) {
      case 'gt':
        return sql`${colExpr} > ${value}`;
      case 'gte':
        return sql`${colExpr} >= ${value}`;
      case 'lt':
        return sql`${colExpr} < ${value}`;
      case 'lte':
        return sql`${colExpr} <= ${value}`;
      case 'eq':
        return sql`${colExpr} = ${value}`;
      default:
        return sql`true`;
    }
  });

  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(customerConds.length ? and(...customerConds) : undefined)
    .groupBy(customers.id)
    .having(having.length ? and(...having) : undefined);

  return rows.map((r) => r.id);
}
