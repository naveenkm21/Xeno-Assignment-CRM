'use client';
import dynamic from 'next/dynamic';

// Clerk's UserButton injects a portal that differs between server/client
// snapshots under Turbopack — wrapping in next/dynamic with ssr:false
// avoids the hydration warning. The skeleton holds the same width so the
// nav doesn't jump when the real button mounts.
const ClerkUserButton = dynamic(
  () => import('@clerk/nextjs').then((m) => m.UserButton),
  {
    ssr: false,
    loading: () => (
      <div className="w-8 h-8 rounded-full bg-white/[0.08] border border-white/10 animate-pulse" />
    ),
  },
);

export function UserButton() {
  return (
    <ClerkUserButton
      afterSignOutUrl="/"
      appearance={{ elements: { avatarBox: 'w-8 h-8 ring-2 ring-white/10' } }}
    />
  );
}
