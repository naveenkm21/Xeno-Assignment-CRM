import type { ChannelKind } from '@xeno/types';

export const estimateImpactSchema = {
  type: 'function',
  function: {
    name: 'estimate_impact',
    description:
      'Rough back-of-envelope expected orders and revenue for a campaign. Uses industry-standard conversion rates per channel — flag confidence low when the audience is small or behaviour is unusual.',
    parameters: {
      type: 'object',
      properties: {
        audienceSize: { type: 'number' },
        primaryChannel: { type: 'string', enum: ['whatsapp', 'email', 'sms', 'rcs'] },
        avgOrderValue: { type: 'number', description: 'Rupees.' },
      },
      required: ['audienceSize', 'primaryChannel', 'avgOrderValue'],
    },
  },
} as const;

const CONVERSION: Record<ChannelKind, { delivered: number; opened: number; clicked: number; converted: number }> = {
  whatsapp: { delivered: 0.95, opened: 0.78, clicked: 0.18, converted: 0.07 },
  email: { delivered: 0.92, opened: 0.28, clicked: 0.05, converted: 0.018 },
  sms: { delivered: 0.94, opened: 0.55, clicked: 0.08, converted: 0.025 },
  rcs: { delivered: 0.85, opened: 0.62, clicked: 0.14, converted: 0.05 },
};

export function runEstimateImpact(args: {
  audienceSize: number;
  primaryChannel: ChannelKind;
  avgOrderValue: number;
}) {
  const r = CONVERSION[args.primaryChannel];
  const expectedOrders = Math.round(args.audienceSize * r.delivered * r.converted);
  const expectedRevenue = Math.round(expectedOrders * args.avgOrderValue);
  const confidence: 'low' | 'medium' | 'high' =
    args.audienceSize < 200 ? 'low' : args.audienceSize < 2000 ? 'medium' : 'high';
  return { expectedOrders, expectedRevenue, confidence, conversionRates: r };
}
