import type { NextConfig } from 'next';
import { config } from 'dotenv';
import { resolve } from 'node:path';

// Load the repo-root .env (the same one every workspace reads) so a single
// file holds DATABASE_URL, GROQ_API_KEY etc.
config({ path: resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
  transpilePackages: ['@xeno/db', '@xeno/ai', '@xeno/types'],
  // Drizzle/neon-serverless ships ESM; keep them external from the server bundle.
  serverExternalPackages: ['@neondatabase/serverless', 'drizzle-orm', 'groq-sdk'],
};

export default nextConfig;
