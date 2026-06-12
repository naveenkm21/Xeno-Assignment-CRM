import { chat, DRAFTER_MODEL } from './client';

const PLAN_ENHANCE_PROMPT = `You take a marketer's rough one-liner and rewrite it as a precise, sendable campaign brief.

# Rules
- Output ONE sentence, max 220 characters. No preamble, no quotes, no markdown.
- Add specifics that were missing in the original. Prefer these dimensions, in order of impact:
  audience criteria → message angle/offer → primary channel → send timing.
- Use Aroma Coffee Co. context: D2C coffee brand in India, ₹ currency, Indian cities, WhatsApp big.
- Keep the marketer's intent. Don't change the goal — sharpen it.
- Tone: confident, punchy, slightly informal. Avoid corporate filler ("leverage", "drive engagement").

# Examples
in: bring back lapsed customers
out: Win back shoppers who haven't ordered in 60+ days with 15% off their favourite blend — WhatsApp Saturday 11 AM IST.

in: push winter blend
out: Promote the new winter blend to top-20% LTV shoppers in Tier-1 cities — WhatsApp + Email follow-up, send Friday evening.

in: cart abandoners
out: Recover cart abandoners from the last 7 days with a free-shipping nudge — WhatsApp within the hour they abandoned.

in: birthday people
out: Send a free pour-over kit offer to customers with birthdays this week — Email primary, WhatsApp fallback.`;

const AUTOPILOT_ENHANCE_PROMPT = `You take a marketer's rough goal and rewrite it as a precise autopilot brief — the agent will then decompose it into a portfolio of campaigns.

# Rules
- Output ONE sentence, max 240 characters. No preamble, no quotes, no markdown.
- ALWAYS include: a target metric (orders/revenue/reach), a deadline (this week / Saturday / by Sun), and a budget if reasonable to infer.
- Tone: punchy, confident.

# Examples
in: get more orders
out: Get me 100 orders this week, ₹50k budget — mix of winback, upsell and cart recovery is fine.

in: max revenue
out: Maximise revenue by Sunday, no budget cap — go after every cohort with real intent signal.

in: fill the funnel
out: Bring in 500 new active shoppers this fortnight, ₹80k budget — winback + welcome + first-purchase nudge.`;

export async function enhancePrompt(args: {
  input: string;
  mode: 'plan' | 'autopilot';
}): Promise<string> {
  const system = args.mode === 'autopilot' ? AUTOPILOT_ENHANCE_PROMPT : PLAN_ENHANCE_PROMPT;
  const completion = await chat({
    model: DRAFTER_MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `in: ${args.input.trim()}\nout:` },
    ],
    temperature: 0.5,
    maxTokens: 180,
  });
  const raw = completion.choices[0]?.message?.content?.trim() ?? '';
  // Strip any accidental quotes or leading "out:" if the model echoed it.
  return raw.replace(/^out:\s*/i, '').replace(/^["']|["']$/g, '').trim();
}
