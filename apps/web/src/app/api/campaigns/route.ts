import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db, audiences, campaigns, communications, customers } from '@xeno/db';
import { desc, eq, inArray } from 'drizzle-orm';
import { campaignPlanSchema, sendRequestSchema } from '@xeno/types';
import { materializeAudience } from '@/lib/audience';
import { randomUUID } from 'node:crypto';

export const runtime = 'nodejs';

const CHANNEL_BASE_URL = process.env.CHANNEL_BASE_URL ?? 'http://localhost:4000';
const WEB_BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:3000';

export async function GET() {
  const list = await db
    .select()
    .from(campaigns)
    .orderBy(desc(campaigns.createdAt))
    .limit(20);
  return NextResponse.json({ campaigns: list });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json();
  const planParse = campaignPlanSchema.safeParse(body?.plan);
  if (!planParse.success) {
    return NextResponse.json(
      { error: 'invalid plan', issues: planParse.error.issues },
      { status: 400 },
    );
  }
  const plan = planParse.data;

  // 1) Snapshot the audience and persist as a stored row for the campaign.
  const [aud] = await db
    .insert(audiences)
    .values({
      name: plan.audience.description.slice(0, 80),
      description: plan.audience.description,
      filter: plan.audience,
      snapshotSize: plan.estimate?.audienceSize ?? 0,
      createdBy: userId,
    })
    .returning({ id: audiences.id });

  // 2) Create the campaign in 'sending' state.
  const [camp] = await db
    .insert(campaigns)
    .values({
      name: plan.goal.slice(0, 80),
      goal: plan.goal,
      plan,
      audienceId: aud.id,
      status: 'sending',
      createdBy: userId,
      startedAt: new Date(),
    })
    .returning({ id: campaigns.id });

  // 3) Materialize the audience (with opt-in enforcement).
  const targetIds = await materializeAudience(plan.audience, plan.channelMix.primary);
  if (targetIds.length === 0) {
    await db
      .update(campaigns)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
    return NextResponse.json({ id: camp.id, sent: 0, warning: 'empty audience after opt-in filter' });
  }

  // 4) Load contact details (we only need fields the channel-stub will use).
  const contactRows = await db
    .select({
      id: customers.id,
      firstName: customers.firstName,
      email: customers.email,
      phone: customers.phone,
    })
    .from(customers)
    .where(inArray(customers.id, targetIds));

  // 5) Round-robin assign variant tags so each variant gets ~equal traffic.
  const variants = plan.variants.filter((v) => v.channel === plan.channelMix.primary);
  const variantPool = variants.length ? variants : plan.variants;

  // 6) Build communications + the send request.
  const commRows: typeof communications.$inferInsert[] = [];
  const sendComms: Array<{
    commId: string;
    channel: typeof plan.channelMix.primary;
    recipient: { customerId: string; phone?: string; email?: string };
    body: string;
    subject?: string;
    variantTag: string;
  }> = [];

  contactRows.forEach((c, i) => {
    const v = variantPool[i % variantPool.length]!;
    const commId = randomUUID();
    const personalized = v.body.replaceAll('{{first_name}}', c.firstName);
    const personalizedSubject = v.subject?.replaceAll('{{first_name}}', c.firstName);
    commRows.push({
      id: commId,
      campaignId: camp.id,
      customerId: c.id,
      channel: plan.channelMix.primary,
      variantTag: v.variantTag,
      body: personalized,
      subject: personalizedSubject,
      state: 'queued',
    });
    sendComms.push({
      commId,
      channel: plan.channelMix.primary,
      recipient: { customerId: c.id, phone: c.phone ?? undefined, email: c.email ?? undefined },
      body: personalized,
      subject: personalizedSubject,
      variantTag: v.variantTag,
    });
  });

  // Chunk DB inserts to stay under Neon's param limit.
  for (let i = 0; i < commRows.length; i += 500) {
    await db.insert(communications).values(commRows.slice(i, i + 500));
  }

  // 7) Call the channel-stub in batches.
  const callbackUrl = `${WEB_BASE_URL}/api/receipt`;
  for (let i = 0; i < sendComms.length; i += 200) {
    const slice = sendComms.slice(i, i + 200);
    const payload = sendRequestSchema.parse({
      campaignId: camp.id,
      callbackUrl,
      communications: slice,
    });
    const res = await fetch(`${CHANNEL_BASE_URL}/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // Best-effort: if the channel rejects a batch, surface but keep going.
      console.error('channel /send rejected batch', await res.text());
    }
  }

  return NextResponse.json({ id: camp.id, sent: sendComms.length });
}
