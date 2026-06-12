import type { ChannelKind, LifecycleState } from '@xeno/types';

/**
 * Realistic-ish lifecycle simulator. Returns the sequence of events to emit
 * for a single communication, with relative delays in ms. The driver picks
 * absolute timestamps when it actually publishes.
 *
 * The conversion funnel is intentionally per-channel — WhatsApp opens way
 * harder than email but converts less than RCS. Marketers should see those
 * gaps in the live monitor.
 */
type Step = { state: LifecycleState; delayMs: number; meta?: Record<string, string | number | boolean> };

const RATES: Record<ChannelKind, { fail: number; bounce: number; open: number; click: number; convert: number }> = {
  whatsapp: { fail: 0.03, bounce: 0.02, open: 0.62, click: 0.18, convert: 0.07 },
  email: { fail: 0.04, bounce: 0.04, open: 0.34, click: 0.06, convert: 0.018 },
  sms: { fail: 0.06, bounce: 0.0, open: 0.5, click: 0.07, convert: 0.022 },
  rcs: { fail: 0.08, bounce: 0.02, open: 0.55, click: 0.14, convert: 0.05 },
};

function jitter(baseMs: number, spread = 0.5): number {
  return Math.round(baseMs * (1 - spread + Math.random() * spread * 2));
}

export function simulateLifecycle(channel: ChannelKind): Step[] {
  const r = RATES[channel];
  const steps: Step[] = [];

  // Initial send acknowledgement (immediate).
  steps.push({ state: 'sent', delayMs: 0 });

  // Failure paths first — exit early.
  if (Math.random() < r.fail) {
    steps.push({
      state: 'failed',
      delayMs: jitter(800),
      meta: { reason: ['unreachable', 'rate_limited', 'invalid_recipient'][Math.floor(Math.random() * 3)]! },
    });
    return steps;
  }
  if (Math.random() < r.bounce) {
    steps.push({ state: 'bounced', delayMs: jitter(1500) });
    return steps;
  }

  // Happy path.
  steps.push({ state: 'delivered', delayMs: jitter(1200) });

  if (Math.random() < r.open) {
    steps.push({ state: 'opened', delayMs: jitter(15_000, 0.8) });

    if (Math.random() < r.click) {
      steps.push({
        state: 'clicked',
        delayMs: jitter(8_000, 0.7),
        meta: { utm_campaign: 'demo', target: 'pdp' },
      });

      if (Math.random() < r.convert) {
        steps.push({
          state: 'converted',
          delayMs: jitter(60_000, 0.9),
          meta: { order_value: 100 + Math.floor(Math.random() * 900) },
        });
      }
    }
  }

  return steps;
}
