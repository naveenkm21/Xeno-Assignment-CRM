import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '../../.env') });

import { faker } from '@faker-js/faker';
import { dbPool, customers, orders } from './index';

const NUM_CUSTOMERS = 5_000;
const AVG_ORDERS_PER_CUSTOMER = 6;
const CITIES = [
  'Mumbai',
  'Bengaluru',
  'Delhi',
  'Hyderabad',
  'Pune',
  'Chennai',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Gurugram',
];

// Categorise shoppers into segments with different behaviour profiles so the
// audience engine has real cohorts to find: lapsed, dormant, regular, VIP.
type Segment = { name: 'lapsed' | 'dormant' | 'regular' | 'vip'; share: number };
const SEGMENTS: Segment[] = [
  { name: 'lapsed', share: 0.18 }, // last order 60-180d ago, low frequency
  { name: 'dormant', share: 0.22 }, // last order 180-540d ago
  { name: 'regular', share: 0.45 }, // active in last 30-60d
  { name: 'vip', share: 0.15 }, // active + high LTV
];

function pickSegment(): Segment['name'] {
  const r = Math.random();
  let cum = 0;
  for (const s of SEGMENTS) {
    cum += s.share;
    if (r <= cum) return s.name;
  }
  return 'regular';
}

function ordersForSegment(segment: Segment['name']) {
  switch (segment) {
    case 'lapsed':
      return { count: faker.number.int({ min: 1, max: 3 }), aov: 280, recencyDays: faker.number.int({ min: 60, max: 180 }) };
    case 'dormant':
      return { count: faker.number.int({ min: 0, max: 2 }), aov: 240, recencyDays: faker.number.int({ min: 180, max: 540 }) };
    case 'regular':
      return { count: faker.number.int({ min: 3, max: 12 }), aov: 320, recencyDays: faker.number.int({ min: 1, max: 60 }) };
    case 'vip':
      return { count: faker.number.int({ min: 15, max: 40 }), aov: 480, recencyDays: faker.number.int({ min: 0, max: 21 }) };
  }
}

async function main() {
  const db = dbPool();
  console.log('seeding…');

  // Wipe existing demo data — safe because the brief is a demo, not prod.
  await db.delete(orders);
  await db.delete(customers);

  const customerRows: typeof customers.$inferInsert[] = [];
  const customerSegments: Array<{ id: string; segment: Segment['name'] }> = [];

  for (let i = 0; i < NUM_CUSTOMERS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const segment = pickSegment();
    const customerId = faker.string.uuid();
    customerSegments.push({ id: customerId, segment });
    customerRows.push({
      id: customerId,
      firstName,
      lastName,
      email: faker.helpers.maybe(
        () =>
          faker.internet.email({ firstName, lastName, provider: 'gmail.com' }).toLowerCase(),
        { probability: 0.92 },
      ),
      phone: faker.helpers.maybe(
        () => `+91${faker.string.numeric({ length: 10 })}`,
        { probability: 0.88 },
      ),
      city: faker.helpers.arrayElement(CITIES),
      optInWhatsapp: faker.datatype.boolean({ probability: 0.78 }),
      optInEmail: faker.datatype.boolean({ probability: 0.85 }),
      optInSms: faker.datatype.boolean({ probability: 0.25 }),
      tags: faker.helpers.arrayElements(
        ['cold-brew', 'beans', 'subscription', 'gifting', 'cafe-walkin'],
        { min: 0, max: 3 },
      ),
      createdAt: faker.date.between({
        from: '2023-01-01',
        to: '2025-09-30',
      }),
    });
  }

  // Insert customers in chunks — Neon caps params per query at ~65k.
  for (let i = 0; i < customerRows.length; i += 500) {
    await db.insert(customers).values(customerRows.slice(i, i + 500));
  }
  console.log(`inserted ${customerRows.length} customers`);

  // Build orders distribution. Use today minus recency for the most recent
  // order per customer, then spread the rest backwards.
  const orderRows: typeof orders.$inferInsert[] = [];
  for (const { id: customerId, segment } of customerSegments) {
    const { count, aov, recencyDays } = ordersForSegment(segment);
    const mostRecent = faker.date.recent({ days: Math.max(1, recencyDays) });

    for (let k = 0; k < count; k++) {
      const placedAt =
        k === 0
          ? mostRecent
          : faker.date.between({
              from: new Date(Date.now() - 540 * 86_400_000),
              to: mostRecent,
            });
      const itemCount = faker.number.int({ min: 1, max: 4 });
      const total = (aov * itemCount * faker.number.float({ min: 0.7, max: 1.4 })).toFixed(2);
      orderRows.push({
        customerId,
        total,
        itemCount,
        channelOrigin: faker.helpers.arrayElement(['web', 'app', 'pos']),
        placedAt,
      });
    }
  }

  for (let i = 0; i < orderRows.length; i += 500) {
    await db.insert(orders).values(orderRows.slice(i, i + 500));
  }
  console.log(`inserted ${orderRows.length} orders`);

  console.log('done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
