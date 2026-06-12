'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconArrowUp,
  IconMessage,
  IconPlus,
  IconLoader2,
  IconRocket,
  IconSparkles,
  IconWand,
} from '@tabler/icons-react';
import { cn } from '@/lib/cn';

export function BriefInput({
  suggestions,
  mode = 'plan',
  placeholder,
}: {
  suggestions: string[];
  mode?: 'plan' | 'autopilot';
  placeholder?: string;
}) {
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const [enhancing, setEnhancing] = useState(false);
  const [justEnhanced, setJustEnhanced] = useState(false);
  const router = useRouter();

  const submit = (goal: string) => {
    if (!goal.trim()) return;
    start(async () => {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ initialMessage: goal, mode }),
      });
      if (!res.ok) return;
      const { id } = await res.json();
      router.push(`/chat/${id}`);
    });
  };

  async function enhance() {
    if (!value.trim() || enhancing) return;
    setEnhancing(true);
    setJustEnhanced(false);
    try {
      const res = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: value, mode }),
      });
      if (!res.ok) return;
      const { enhanced } = (await res.json()) as { enhanced: string };
      if (enhanced) {
        setValue(enhanced);
        setJustEnhanced(true);
        // Glow effect fades after 1.5s
        setTimeout(() => setJustEnhanced(false), 1500);
      }
    } finally {
      setEnhancing(false);
    }
  }

  const ph =
    placeholder ??
    (mode === 'autopilot'
      ? "e.g. get 100 orders this week, ₹50k budget"
      : "e.g. bring back shoppers who ghosted us 60+ days ago...");

  const accentGrad = mode === 'autopilot' ? 'var(--grad-cyan)' : 'var(--grad-violet)';
  const canEnhance = value.trim().length >= 2;

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'surface-raised flex items-center gap-2 px-5 py-4 transition-all duration-300 relative',
          mode === 'autopilot'
            ? 'focus-within:border-cyan-400/40'
            : 'focus-within:border-violet-400/40',
          'focus-within:shadow-glow',
          justEnhanced && 'shadow-glow border-violet-400/50',
          pending && 'opacity-70 pointer-events-none',
        )}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault();
            submit(value);
          }
        }}
      >
        {mode === 'autopilot' ? (
          <IconRocket size={18} className="text-cyan-300 flex-shrink-0" />
        ) : (
          <IconMessage size={18} className="text-ink-faint flex-shrink-0" />
        )}
        <input
          type="text"
          autoFocus
          placeholder={ph}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={enhancing}
          className={cn(
            'flex-1 bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none text-ink transition-opacity',
            enhancing && 'opacity-50',
          )}
        />

        {/* Enhance button */}
        <button
          type="button"
          onClick={enhance}
          disabled={!canEnhance || enhancing}
          aria-label="Enhance prompt"
          title="Sharpen this brief with AI"
          className={cn(
            'group/enh w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 relative',
            canEnhance && !enhancing
              ? 'bg-white/[0.05] border border-white/10 text-violet-300 hover:bg-white/[0.09] hover:border-violet-400/40 hover:text-violet-200 hover:-translate-y-px'
              : 'opacity-30 cursor-not-allowed border border-white/5',
          )}
        >
          {enhancing ? (
            <IconLoader2 size={14} className="animate-spin" />
          ) : (
            <IconWand size={14} className="group-hover/enh:rotate-12 transition-transform" />
          )}
          {/* Tooltip hint */}
          {canEnhance && !enhancing && (
            <span className="absolute -bottom-7 right-0 chip !py-0.5 !px-1.5 text-[10px] opacity-0 group-hover/enh:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              <IconSparkles size={9} /> enhance
            </span>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Send button */}
        <button
          type="button"
          onClick={() => submit(value)}
          aria-label="Send"
          className={cn(
            'w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-md transition-all duration-200',
            'hover:shadow-glow hover:-translate-y-0.5',
            'disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0',
          )}
          style={{ background: accentGrad }}
          disabled={!value.trim() || pending}
        >
          {pending ? (
            <IconLoader2 size={16} className="animate-spin" />
          ) : (
            <IconArrowUp size={16} />
          )}
        </button>

        {/* "Enhanced" toast */}
        {justEnhanced && (
          <span
            className="absolute -top-3 left-5 chip pill-violet !py-0.5 !px-2 !text-[10px] stream-in font-semibold"
            style={{ background: 'rgba(167, 139, 250, 0.18)' }}
          >
            <IconSparkles size={9} /> enhanced
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            disabled={pending}
            className="chip chip-action"
          >
            <IconPlus size={12} />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
