import { campaignPlanSchema, type CampaignPlan } from '@xeno/types';

export const finalizePlanSchema = {
  type: 'function',
  function: {
    name: 'finalize_plan',
    description:
      'Emit the complete CampaignPlan for the marketer to approve. Call this exactly once, after all other tool calls. The UI renders the result for approval.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string' },
        audience: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            rules: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  op: { type: 'string' },
                  value: {},
                },
                required: ['field', 'op', 'value'],
              },
            },
          },
          required: ['description', 'rules'],
        },
        variants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              channel: { type: 'string', enum: ['whatsapp', 'email', 'sms', 'rcs'] },
              body: { type: 'string' },
              subject: { type: 'string' },
              variantTag: { type: 'string' },
            },
            required: ['channel', 'body', 'variantTag'],
          },
        },
        channelMix: {
          type: 'object',
          properties: {
            primary: { type: 'string', enum: ['whatsapp', 'email', 'sms', 'rcs'] },
            fallback: { type: 'string', enum: ['whatsapp', 'email', 'sms', 'rcs'] },
            fallbackAfterHours: { type: 'number' },
          },
          required: ['primary'],
        },
        sendWindow: {
          type: 'object',
          properties: {
            sendAt: { type: 'string', description: 'ISO datetime or "now"' },
            throttlePerMinute: { type: 'number' },
          },
          required: ['sendAt'],
        },
        estimate: {
          type: 'object',
          properties: {
            audienceSize: { type: 'number' },
            expectedOrders: { type: 'number' },
            expectedRevenue: { type: 'number' },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          },
        },
      },
      required: ['goal', 'audience', 'variants', 'channelMix', 'sendWindow'],
    },
  },
} as const;

export function runFinalizePlan(args: unknown): CampaignPlan {
  // Validate strictly — the LLM's output must conform before we trust it.
  return campaignPlanSchema.parse(args);
}
