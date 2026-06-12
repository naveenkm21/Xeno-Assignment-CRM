import { and, count, eq, gt, gte, lt, lte, sql, inArray, notInArray } from 'drizzle-orm';
import { customers, orders, db } from '@xeno/db';
import { audienceFilterSchema, type AudienceFilter } from '@xeno/types';

export const queryAudienceSchema = {
  type: 'function',
  function: {
    name: 'query_audience',
    description:
      'Translate the marketer\'s goal into a structured audience filter and return the matching customer count plus a small sample. Always call this before drafting messages.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'One-sentence plain-English description of who this audience is.',
        },
        rules: {
          type: 'array',
          description: 'List of filter rules. ANDed together.',
          items: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: [
                  'last_order_at',
                  'order_count',
                  'lifetime_value',
                  'avg_order_value',
                  'city',
                  'opt_in_whatsapp',
                  'opt_in_email',
                  'opt_in_sms',
                  'tags',
                ],
              },
              op: {
                type: 'string',
                enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'nin', 'between'],
              },
              value: {
                description:
                  'String, number, boolean, or array. For last_order_at use ISO date OR number-of-days-ago as a negative integer (e.g. -60 means 60 days ago).',
              },
            },
            required: ['field', 'op', 'value'],
          },
        },
      },
      required: ['description', 'rules'],
    },
  },
} as const;

/**
 * Run a (validated) AudienceFilter against Postgres. We resolve customer-level
 * predicates directly, and order-derived predicates (last_order_at,
 * order_count, lifetime_value, avg_order_value) via a CTE join on the orders
 * table — so the LLM doesn't need to know how to do that.
 */
export async function runQueryAudience(filter: AudienceFilter) {
  // Validate, raise nice error if shape is wrong.
  const parsed = audienceFilterSchema.parse(filter);

  // Bucket the rules so we can build the SQL once.
  const customerConds: ReturnType<typeof eq>[] = [];
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
    if (r.field === 'tags' && r.op === 'in' && Array.isArray(r.value)) {
      // tags @> ARRAY[...] semantics.
      customerConds.push(
        sql`${customers.tags} ?| array[${sql.join(r.value.map((v) => sql`${String(v)}`), sql`, `)}]` as unknown as ReturnType<typeof eq>,
      );
    }
  }

  // Build per-customer aggregate having-clauses.
  const havingFragments = aggConds.map((c) => {
    const colExpr = (() => {
      if (c.field === 'last_order_at') return sql<Date>`max(${orders.placedAt})`;
      if (c.field === 'order_count') return sql<number>`count(${orders.id})`;
      if (c.field === 'lifetime_value') return sql<number>`coalesce(sum(${orders.total}), 0)`;
      if (c.field === 'avg_order_value') return sql<number>`coalesce(avg(${orders.total}), 0)`;
      throw new Error(`unknown agg field ${c.field}`);
    })();
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
        throw new Error(`unsupported op ${c.op} for ${c.field}`);
    }
  });

  const whereExpr = customerConds.length ? and(...customerConds) : undefined;

  // Aggregate join: every customer + their order stats. Apply having if any.
  const matched = db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      city: customers.city,
      lastOrderAt: sql<Date>`max(${orders.placedAt})`.as('last_order_at'),
      orderCount: sql<number>`count(${orders.id})::int`.as('order_count'),
      lifetimeValue: sql<number>`coalesce(sum(${orders.total}), 0)::float`.as('ltv'),
    })
    .from(customers)
    .leftJoin(orders, eq(orders.customerId, customers.id))
    .where(whereExpr)
    .groupBy(customers.id)
    .having(havingFragments.length ? and(...havingFragments) : undefined)
    .as('matched');

  const countRows = await db.select({ total: count() }).from(matched);
  const total = countRows[0]?.total ?? 0;

  const sample = await db.select().from(matched).limit(8);

  return {
    description: parsed.description,
    rules: parsed.rules,
    size: Number(total),
    sample,
  };
}
