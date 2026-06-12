import express from 'express';
import pinoHttp from 'pino-http';
import { env } from './env';
import { logger } from './logger';
import { sendQueue, type SendJob } from './queue';
import { startWorker } from './worker';
import { sendRequestSchema } from '@xeno/types';

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

app.get('/health', (_req, res) => res.json({ ok: true, service: 'channel-stub' }));

app.post('/send', async (req, res) => {
  const parse = sendRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: 'invalid body', issues: parse.error.issues });
  }
  const { campaignId, communications, callbackUrl } = parse.data;

  // Enqueue per-communication. Using `bulk` lets BullMQ pipeline writes.
  const jobs = communications.map<{ name: string; data: SendJob }>((c) => ({
    name: 'send',
    data: { ...c, campaignId, callbackUrl },
  }));
  await sendQueue.addBulk(
    jobs.map((j) => ({
      name: j.name,
      data: j.data,
      opts: {
        // Idempotency: if the CRM retries the /send call, BullMQ will dedupe.
        jobId: j.data.commId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    })),
  );

  res.status(202).json({
    accepted: communications.length,
    campaignId,
  });
});

// Start worker in-process. In a real deployment you'd split the worker into
// its own dyno; for this assignment co-locating is faster to demo.
startWorker();

app.listen(env.PORT, () => {
  logger.info(`channel-stub listening on :${env.PORT}`);
});
