import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublic = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/receipt(.*)', // signed by HMAC, must accept unauthed
  '/api/health',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return NextResponse.next();
  await auth.protect();
});

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)', '/(api|trpc)(.*)'],
};
