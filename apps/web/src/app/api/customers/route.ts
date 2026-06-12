import { NextResponse } from 'next/server';
import { db, customers, orders } from '@xeno/db';
import { sql, desc, or, ilike } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(50, Number(searchParams.get('limit') ?? '30'));

  const rows = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      lastName: customers.lastName,
      email: customers.email,
      city: customers.city,
      ltv: sql<number>`coalesce(sum(${orders.total}), 0)::float`,
      orderCount: sql<number>`count(${orders.id})::int`,
      lastOrderAt: sql<Date | null>`max(${orders.placedAt})`,
    })
    .from(customers)
    .leftJoin(orders, sql`${orders.customerId} = ${customers.id}`)
    .where(
      q
        ? or(
            ilike(customers.firstName, `%${q}%`),
            ilike(customers.lastName, `%${q}%`),
            ilike(customers.email, `%${q}%`),
            ilike(customers.city, `%${q}%`),
          )
        : undefined,
    )
    .groupBy(customers.id)
    .orderBy(desc(sql`max(${orders.placedAt})`))
    .limit(limit);

  return NextResponse.json({ customers: rows });
}
