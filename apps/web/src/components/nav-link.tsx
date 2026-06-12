'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      className={cn(
        'px-3.5 py-1.5 rounded-lg transition-all duration-200 font-medium text-[13.5px]',
        active
          ? 'text-ink bg-white/[0.06] border border-white/10'
          : 'text-ink-soft hover:text-ink hover:bg-white/[0.04]',
      )}
    >
      {children}
    </Link>
  );
}
