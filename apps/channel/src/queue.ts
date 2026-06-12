import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { env } from './env';

// One Redis connection shared between queue producer and worker. BullMQ
// recommends `maxRetriesPerRequest: null` for the worker side; we use
// `enableReadyCheck: false` so Upstash's TLS quirks don't trip us up.
export const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  family: 0,
});

export const QUEUE_NAME = 'channel-send';

export const sendQueue = new Queue(QUEUE_NAME, { connection });

export type SendJob = {
  commId: string;
  campaignId: string;
  channel: 'whatsapp' | 'email' | 'sms' | 'rcs';
  recipient: {
    customerId: string;
    phone?: string;
    email?: string;
  };
  body: string;
  subject?: string;
  variantTag: string;
  callbackUrl: string;
};
