import { chat, PLANNER_MODEL } from './client';

/**
 * Produce a short narrative summary of a finished campaign — used in the
 * Insights screen. Kept as a one-shot LLM call (not an agent loop): the data
 * the marketer needs is already aggregated.
 */
export async function summarizeCampaign(args: {
  campaignName: string;
  goal: string;
  metrics: {
    audienceSize: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    converted: number;
    revenue: number;
    perChannel: Record<string, { sent: number; delivered: number; converted: number }>;
    perVariant: Record<string, { sent: number; converted: number }>;
  };
}) {
  const completion = await chat({
    model: PLANNER_MODEL,
    messages: [
      {
        role: 'system',
        content:
          'You are Xeno Copilot summarising a finished campaign for a busy marketer. Be specific: name the winning channel, the winning variant, the conversion lift. Two short paragraphs max. Use ₹ for currency.',
      },
      {
        role: 'user',
        content: `Campaign: ${args.campaignName}\nGoal: ${args.goal}\nMetrics: ${JSON.stringify(args.metrics)}\n\nWrite the summary. End with one specific suggestion for what to do next.`,
      },
    ],
    temperature: 0.5,
    maxTokens: 400,
  });
  return completion.choices[0]?.message?.content ?? '';
}
