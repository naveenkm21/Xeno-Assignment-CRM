import { z } from 'zod';
import { campaignPlanSchema, type CampaignPlan } from '@xeno/types';

export const finalizePortfolioSchema = {
  type: 'function',
  function: {
    name: 'finalize_portfolio',
    description:
      'In autopilot mode only: emit a portfolio of 2-4 campaigns that together hit the marketer\'s broader goal. Each campaign must be a complete CampaignPlan. Include a one-line rationale per campaign and a portfolio-level summary.',
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: "The marketer's high-level goal." },
        rationale: {
          type: 'string',
          description: 'One paragraph explaining why this portfolio hits the goal.',
        },
        budget: {
          type: 'number',
          description: 'Total budget in INR if known, else 0.',
        },
        campaigns: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          description: 'Each item is a full CampaignPlan plus a rationale.',
          items: {
            type: 'object',
            properties: {
              rationale: { type: 'string' },
              plan: {
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
                      fallback: {
                        type: 'string',
                        enum: ['whatsapp', 'email', 'sms', 'rcs'],
                      },
                      fallbackAfterHours: { type: 'number' },
                    },
                    required: ['primary'],
                  },
                  sendWindow: {
                    type: 'object',
                    properties: {
                      sendAt: { type: 'string' },
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
            required: ['rationale', 'plan'],
          },
        },
        portfolioEstimate: {
          type: 'object',
          properties: {
            totalReach: { type: 'number' },
            expectedOrders: { type: 'number' },
            expectedRevenue: { type: 'number' },
          },
        },
      },
      required: ['goal', 'rationale', 'campaigns'],
    },
  },
} as const;

const portfolioInputSchema = z.object({
  goal: z.string(),
  rationale: z.string(),
  budget: z.number().optional(),
  campaigns: z
    .array(
      z.object({
        rationale: z.string(),
        plan: campaignPlanSchema,
      }),
    )
    .min(2)
    .max(4),
  portfolioEstimate: z
    .object({
      totalReach: z.number(),
      expectedOrders: z.number(),
      expectedRevenue: z.number(),
    })
    .optional(),
});

export type Portfolio = z.infer<typeof portfolioInputSchema>;

export function runFinalizePortfolio(args: unknown): Portfolio {
  return portfolioInputSchema.parse(args);
}
