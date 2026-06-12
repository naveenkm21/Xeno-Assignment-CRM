import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { enhancePrompt } from '@xeno/ai';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 20;

const bodySchema = z.object({
  input: z.string().min(2).max(500),
  mode: z.enum(['plan', 'autopilot']).default('plan'),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const parse = bodySchema.safeParse(await req.json());
  if (!parse.success) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  try {
    const enhanced = await enhancePrompt({
      input: parse.data.input,
      mode: parse.data.mode,
    });
    return NextResponse.json({ enhanced });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
