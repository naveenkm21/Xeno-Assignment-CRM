'use client';
import { useEffect, useState } from 'react';
import { IconSun, IconMoon } from '@tabler/icons-react';
import { cn } from '@/lib/cn';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('xeno-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return 'dark';
}

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial = getInitial();
    setTheme(initial);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('xeno-theme', next);
    } catch {}
  }

  // Render the same shape on server + first client paint to avoid hydration jump.
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center text-ink-soft hover:text-ink hover:bg-muted transition-all border border-transparent hover:border-border',
        className,
      )}
    >
      {mounted ? (
        theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />
      ) : (
        <span className="w-4 h-4" />
      )}
    </button>
  );
}
