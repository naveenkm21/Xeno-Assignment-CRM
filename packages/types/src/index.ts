import { z } from 'zod';

export const channelKinds = ['whatsapp', 'email', 'sms', 'rcs'] as const;
export type ChannelKind = (typeof channelKinds)[number];

export const lifecycleStates = [
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'converted',
  'failed',
  'bounced',
  'unsubscribed',
] as const;
export type LifecycleState = (typeof lifecycleStates)[number];

export const campaignStatuses = [
  'draft',
  'scheduled',
  'sending',
  'completed',
  'failed',
  'cancelled',
] as const;
export type CampaignStatus = (typeof campaignStatuses)[number];

export const audienceFilterSchema = z.object({
  // Plain-English description the LLM produced; UI shows this above the rules.
  description: z.string().min(1),
  rules: z.array(
    z.object({
      field: z.enum([
        'last_order_at',
        'order_count',
        'lifetime_value',
        'avg_order_value',
        'city',
        'opt_in_whatsapp',
        'opt_in_email',
        'opt_in_sms',
        'tags',
      ]),
      op: z.enum(['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'in', 'nin', 'between']),
      value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
    }),
  ),
});
export type AudienceFilter = z.infer<typeof audienceFilterSchema>;

export const messageVariantSchema = z.object({
  channel: z.enum(channelKinds),
  // Use {{first_name}}, {{discount_code}} etc. as merge fields.
  body: z.string().min(1).max(2000),
  // Email-only.
  subject: z.string().optional(),
  // For UI lineage.
  variantTag: z.string().default('A'),
});
export type MessageVariant = z.infer<typeof messageVariantSchema>;

export const campaignPlanSchema = z.object({
  goal: z.string(),
  audience: audienceFilterSchema,
  variants: z.array(messageVariantSchema).min(1).max(4),
  channelMix: z.object({
    primary: z.enum(channelKinds),
    fallback: z.enum(channelKinds).optional(),
    // Window in hours after primary send before fallback fires (if recipient hasn't opened).
    fallbackAfterHours: z.number().int().min(1).max(168).default(24),
  }),
  sendWindow: z.object({
    // ISO timestamp. "now" means send immediately on approval.
    sendAt: z.union([z.literal('now'), z.string().datetime()]),
    // Optional throttle — messages per minute, demo default low.
    throttlePerMinute: z.number().int().min(1).max(10000).default(120),
  }),
  estimate: z
    .object({
      audienceSize: z.number().int().min(0),
      expectedOrders: z.number().int().min(0).optional(),
      expectedRevenue: z.number().min(0).optional(),
      confidence: z.enum(['low', 'medium', 'high']).default('medium'),
    })
    .optional(),
});
export type CampaignPlan = z.infer<typeof campaignPlanSchema>;

// Sent from CRM to channel-stub.
export const sendRequestSchema = z.object({
  campaignId: z.string().uuid(),
  communications: z
    .array(
      z.object({
        commId: z.string().uuid(),
        channel: z.enum(channelKinds),
        recipient: z.object({
          customerId: z.string().uuid(),
          phone: z.string().optional(),
          email: z.string().email().optional(),
        }),
        body: z.string(),
        subject: z.string().optional(),
        variantTag: z.string(),
      }),
    )
    .min(1)
    .max(1000),
  // Where channel-stub should POST receipts to.
  callbackUrl: z.string().url(),
});
export type SendRequest = z.infer<typeof sendRequestSchema>;

// Sent from channel-stub back to CRM /api/receipt.
export const receiptSchema = z.object({
  commId: z.string().uuid(),
  campaignId: z.string().uuid(),
  state: z.enum(lifecycleStates),
  occurredAt: z.string().datetime(),
  channel: z.enum(channelKinds),
  // Free-form details: failure reason, click URL, etc.
  meta: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});
export type Receipt = z.infer<typeof receiptSchema>;

export const receiptBatchSchema = z.object({
  receipts: z.array(receiptSchema).min(1).max(500),
});
export type ReceiptBatch = z.infer<typeof receiptBatchSchema>;
