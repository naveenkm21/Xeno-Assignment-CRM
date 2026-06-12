import { neon, neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Required when running outside Vercel/Cloudflare workers (Node, scripts, etc.)
// — Neon's pool driver speaks websockets.
if (typeof globalThis.WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

export * from './schema';
export { schema };

function getUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required (set it in the repo-root .env).');
  }
  return url;
}

/**
 * Default client — uses Neon's HTTP driver. Best for the request path on
 * serverless platforms (Vercel): no connection pool to keep warm, every
 * query is a single HTTP round trip.
 *
 * Lazily constructed via a Proxy so importing this module at build time (when
 * env vars may not yet be present) doesn't blow up. The first time anyone
 * actually reads a property, the client is built.
 *
 * Use `dbPool` instead when you need transactions or many queries in one call.
 */
let _http: ReturnType<typeof drizzleHttp> | null = null;
function getHttp() {
  if (!_http) _http = drizzleHttp(neon(getUrl()), { schema });
  return _http;
}
export const db = new Proxy({} as ReturnType<typeof drizzleHttp>, {
  get(_t, p, r) {
    return Reflect.get(getHttp() as object, p, r);
  },
});

let _pool: Pool | null = null;
/**
 * Connection-pooled client for transactional or batch workloads (seed script,
 * receipt ingester batch upserts). Lazily constructed so importing this
 * module from the edge doesn't open a socket.
 */
export function dbPool() {
  if (!_pool) {
    _pool = new Pool({ connectionString: getUrl() });
  }
  return drizzlePool(_pool, { schema });
}
