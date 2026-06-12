import { createHmac, timingSafeEqual } from 'node:crypto';

export function signBody(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export function verifySignature(secret: string, body: string, signature: string): boolean {
  const expected = signBody(secret, body);
  // Length check first; timingSafeEqual throws on mismatched lengths.
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
