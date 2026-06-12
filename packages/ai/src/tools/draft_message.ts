import { z } from 'zod';
import { chat, DRAFTER_MODEL } from '../client';
import { DRAFTER_SYSTEM_PROMPT } from '../prompts';
import { channelKinds, type MessageVariant } from '@xeno/types';

export const draftMessageSchema = {
  type: 'function',
  function: {
    name: 'draft_message',
    description:
      'Produce a single message variant for one channel. Returns the body (and subject for email).',
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', enum: [...channelKinds] },
        angle: {
          type: 'string',
          description:
            'The marketing angle in one phrase, e.g. "we miss you + 15% off" or "celebrate the new winter blend".',
        },
        variantTag: { type: 'string', description: 'Variant identifier like "A" or "B".' },
        constraints: {
          type: 'object',
          description: 'Optional constraints: max discount %, merge fields available, tone.',
          properties: {
            maxDiscountPct: { type: 'number' },
            tone: { type: 'string', enum: ['warm', 'urgent', 'playful', 'premium'] },
          },
        },
      },
      required: ['channel', 'angle', 'variantTag'],
    },
  },
} as const;

const draftSchema = z.object({
  body: z.string().min(1),
  subject: z.string().optional(),
});

export async function runDraftMessage(args: {
  channel: MessageVariant['channel'];
  angle: string;
  variantTag: string;
  constraints?: { maxDiscountPct?: number; tone?: 'warm' | 'urgent' | 'playful' | 'premium' };
}): Promise<MessageVariant> {
  const userPrompt = [
    `Channel: ${args.channel}`,
    `Angle: ${args.angle}`,
    `Variant: ${args.variantTag}`,
    args.constraints?.tone ? `Tone: ${args.constraints.tone}` : null,
    args.constraints?.maxDiscountPct
      ? `Max discount: ${args.constraints.maxDiscountPct}%`
      : null,
    '',
    `Return JSON with shape: { "body": string${args.channel === 'email' ? ', "subject": string' : ''} }. No prose outside the JSON.`,
  ]
    .filter(Boolean)
    .join('\n');

  const completion = await chat({
    model: DRAFTER_MODEL,
    messages: [
      { role: 'system', content: DRAFTER_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    responseFormat: { type: 'json_object' },
    temperature: 0.7,
    maxTokens: 400,
  });
  const raw = completion.choices[0]?.message?.content ?? '{}';
  const json = JSON.parse(raw);
  const parsed = draftSchema.parse(json);

  return {
    channel: args.channel,
    body: parsed.body,
    subject: parsed.subject,
    variantTag: args.variantTag,
  };
}
