import { Worker, type Job } from 'bullmq';
import { env } from './env';
import { connection, QUEUE_NAME, type SendJob } from './queue';
import { logger } from './logger';
import { simulateLifecycle } from './simulate';
import { signBody } from './sign';
import type { Receipt } from '@xeno/types';

const DEMO_TIME_SCALE = Number(process.env.CHANNEL_TIME_SCALE ?? '0.05');

async function postReceipt(receipt: Receipt, callbackUrl: string) {
  const body = JSON.stringify({ receipts: [receipt] });
  const sig = signBody(env.CHANNEL_WEBHOOK_SECRET, body);

  // Up to 3 attempts with exponential backoff.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-xeno-signature': sig,
          'x-xeno-attempt': String(attempt + 1),
        },
        body,
      });
      if (res.ok) return;
      logger.warn({ status: res.status, commId: receipt.commId }, 'receipt non-2xx');
    } catch (err) {
      logger.warn({ err, commId: receipt.commId, attempt }, 'receipt post failed');
    }
    await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
  }
  logger.error({ commId: receipt.commId }, 'giving up on receipt after 3 attempts');
}

async function processJob(job: Job<SendJob>) {
  const j = job.data;
  const steps = simulateLifecycle(j.channel);
  logger.info({ commId: j.commId, channel: j.channel, steps: steps.length }, 'simulating');

  // Fire each lifecycle event with its (scaled) delay.
  for (const step of steps) {
    if (step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs * DEMO_TIME_SCALE));
    }
    const receipt: Receipt = {
      commId: j.commId,
      campaignId: j.campaignId,
      state: step.state,
      occurredAt: new Date().toISOString(),
      channel: j.channel,
      meta: step.meta,
    };
    await postReceipt(receipt, j.callbackUrl);
  }
}

export function startWorker() {
  const worker = new Worker<SendJob>(QUEUE_NAME, processJob, {
    connection,
    concurrency: Number(process.env.CHANNEL_CONCURRENCY ?? '20'),
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'job failed');
  });
  worker.on('ready', () => logger.info('worker ready'));
  return worker;
}
