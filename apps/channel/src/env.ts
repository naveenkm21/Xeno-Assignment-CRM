import { config } from 'dotenv';
import { resolve } from 'node:path';
import { z } from 'zod';

// Workspace scripts run with CWD = apps/channel, but .env lives at the repo
// root so every service shares one credentials file.
config({ path: resolve(process.cwd(), '../../.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  REDIS_URL: z.string().min(1),
  WEB_BASE_URL: z.string().url(),
  CHANNEL_WEBHOOK_SECRET: z.string().min(16),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
