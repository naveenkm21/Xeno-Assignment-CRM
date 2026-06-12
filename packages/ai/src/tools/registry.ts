import { queryAudienceSchema, runQueryAudience } from './query_audience';
import { draftMessageSchema, runDraftMessage } from './draft_message';
import { proposeChannelMixSchema, runProposeChannelMix } from './propose_channel_mix';
import { estimateImpactSchema, runEstimateImpact } from './estimate_impact';
import { finalizePlanSchema, runFinalizePlan } from './finalize_plan';
import { finalizePortfolioSchema, runFinalizePortfolio } from './finalize_portfolio';
import type { AudienceFilter, MessageVariant } from '@xeno/types';

export const tools = [
  queryAudienceSchema,
  draftMessageSchema,
  proposeChannelMixSchema,
  estimateImpactSchema,
  finalizePlanSchema,
  finalizePortfolioSchema,
];

// In autopilot mode the agent must call finalize_portfolio, not finalize_plan.
export const autopilotTools = [
  queryAudienceSchema,
  draftMessageSchema,
  proposeChannelMixSchema,
  estimateImpactSchema,
  finalizePortfolioSchema,
];

export type ToolName =
  | 'query_audience'
  | 'draft_message'
  | 'propose_channel_mix'
  | 'estimate_impact'
  | 'finalize_plan'
  | 'finalize_portfolio';

export type ToolContext = {
  lastAudienceCustomerIds?: string[];
};

export const toolHandlers: Record<ToolName, (args: any, ctx: ToolContext) => Promise<unknown> | unknown> = {
  query_audience: async (args: AudienceFilter, ctx) => {
    const result = await runQueryAudience(args);
    ctx.lastAudienceCustomerIds = result.sample.map((s) => s.id);
    return result;
  },
  draft_message: (args: Parameters<typeof runDraftMessage>[0]) => runDraftMessage(args),
  propose_channel_mix: async (args: { customerIds?: string[] }, ctx) => {
    const ids = args.customerIds?.length ? args.customerIds : ctx.lastAudienceCustomerIds ?? [];
    return runProposeChannelMix({ customerIds: ids });
  },
  estimate_impact: (args: Parameters<typeof runEstimateImpact>[0]) => runEstimateImpact(args),
  finalize_plan: (args: unknown) => runFinalizePlan(args),
  finalize_portfolio: (args: unknown) => runFinalizePortfolio(args),
};
