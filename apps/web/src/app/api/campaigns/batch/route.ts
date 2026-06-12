import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { campaignPlanSchema } from '@xeno/types';
import { z } from 'zod';

export const runtime = 'nodejs';

const bodySchema = z.object({
  campaigns: z.array(campaignPlanSchema).min(1).max(8),
});

/**
 * Launch every campaign in a portfolio. Calls the single-campaign creator
 * in series so each campaign goes through the same audience materialisation,
 * comms insertion, and channel-stub dispatch path.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) {
    return NextResponse.json(
      { error: 'invalid body', issues: parse.error.issues },
      { status: 400 },
    );
  }

  const baseUrl =
    process.env.WEB_BASE_URL ?? `http://localhost:${process.env.PORT ?? '3000'}`;

  const results: Array<{ id?: string; error?: string }> = [];
  // Forward the caller's cookie so /api/campaigns sees the same session.
  const cookie = req.headers.get('cookie') ?? '';

  for (const plan of parse.data.campaigns) {
    try {
      const res = await fetch(`${baseUrl}/api/campaigns`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) {
        results.push({ error: await res.text() });
      } else {
        const { id } = await res.json();
        results.push({ id });
      }
    } catch (err) {
      results.push({ error: (err as Error).message });
    }
  }

  return NextResponse.json({ results });
}
