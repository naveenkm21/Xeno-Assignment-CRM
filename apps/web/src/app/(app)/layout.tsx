import Link from 'next/link';
import { IconSparkles } from '@tabler/icons-react';
import { NavLink } from '@/components/nav-link';
import { UserButton } from '@/components/user-button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="surface-glass sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
          <Link href="/home" className="flex items-center gap-2.5 font-semibold tracking-tight">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
              style={{ background: 'var(--grad-violet)' }}
            >
              <IconSparkles size={16} className="text-white" />
            </div>
            <span className="text-[15px]">Xeno Copilot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <NavLink href="/home">Home</NavLink>
            <NavLink href="/chat">Chat</NavLink>
            <NavLink href="/campaigns">Campaigns</NavLink>
            <NavLink href="/customers">Customers</NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span className="font-medium">Aroma Coffee Co.</span>
            </div>
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
