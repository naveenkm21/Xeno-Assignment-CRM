'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowUp, IconLoader2, IconSparkles, IconUser, IconCheck } from '@tabler/icons-react';
import type { CampaignPlan } from '@xeno/types';
import { cn } from '@/lib/cn';
import { PlanPreview } from './plan-preview';
import { PortfolioPreview } from './portfolio-preview';

type Portfolio = {
  goal: string;
  rationale: string;
  campaigns: Array<{ rationale: string; plan: CampaignPlan }>;
  portfolioEstimate?: { totalReach: number; expectedOrders: number; expectedRevenue: number };
};

// A persisted toolResult is either a single CampaignPlan or a Portfolio.
// Discriminate on the presence of `campaigns` array.
function isPortfolio(x: unknown): x is Portfolio {
  return !!x && typeof x === 'object' && Array.isArray((x as { campaigns?: unknown }).campaigns);
}

type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolResult: Record<string, unknown> | null;
};

type LiveTrace = {
  reasoning: string;
  tools: Array<{ id: string; name: string; args: unknown; result?: unknown; error?: string }>;
  plan?: CampaignPlan;
  portfolio?: Portfolio;
  done: boolean;
};

export function ChatView({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: StoredMessage[];
}) {
  const [history, setHistory] = useState<StoredMessage[]>(initialMessages);
  const [live, setLive] = useState<LiveTrace | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const last = history[history.length - 1];
    if (last && last.role === 'user') void runAgent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [history, live]);

  async function runAgent(message?: string) {
    setSending(true);
    setLive({ reasoning: '', tools: [], done: false });
    const res = await fetch('/api/copilot', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversationId, message }),
    });
    if (!res.ok || !res.body) {
      setSending(false);
      setLive(null);
      return;
    }

    if (message) {
      setHistory((h) => [
        ...h,
        { id: `local-${Date.now()}`, role: 'user', content: message, toolResult: null },
      ]);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const trace: LiveTrace = { reasoning: '', tools: [], done: false };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const frame = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const [eventLine, dataLine] = frame.split('\n');
        if (!eventLine?.startsWith('event:') || !dataLine?.startsWith('data:')) continue;
        const event = eventLine.slice(6).trim();
        const data = JSON.parse(dataLine.slice(5).trim());
        if (event === 'reasoning') trace.reasoning += data.text;
        if (event === 'tool_call')
          trace.tools.push({ id: data.id, name: data.name, args: data.args });
        if (event === 'tool_result') {
          const t = trace.tools.find((x) => x.id === data.id);
          if (t) t.result = data.result;
        }
        if (event === 'tool_error') {
          const t = trace.tools.find((x) => x.id === data.id);
          if (t) t.error = data.error;
        }
        if (event === 'final') {
          trace.plan = data.plan as CampaignPlan | undefined;
          trace.portfolio = data.portfolio as Portfolio | undefined;
          trace.reasoning = data.text || trace.reasoning;
        }
        if (event === 'done') trace.done = true;
        setLive({ ...trace });
      }
    }

    setHistory((h) => [
      ...h,
      {
        id: `local-${Date.now() + 1}`,
        role: 'assistant',
        content: trace.reasoning,
        toolResult:
          (trace.portfolio as Record<string, unknown> | undefined) ??
          (trace.plan as Record<string, unknown> | undefined) ??
          null,
      },
    ]);
    setLive(null);
    setSending(false);
    router.refresh();
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-6 h-[calc(100vh-64px)]">
      <div ref={scrollerRef} className="flex-1 overflow-y-auto scrollbar-thin pr-2 space-y-7">
        {history.map((m) => (
          <MessageRow
            key={m.id}
            role={m.role}
            content={m.content}
            plan={m.toolResult as CampaignPlan | null}
          />
        ))}
        {live && <LiveRow trace={live} />}
      </div>
      <div
        className={cn(
          'surface-raised flex items-center gap-3 px-5 py-4 transition-all duration-200',
          'focus-within:border-violet-400/40 focus-within:shadow-glow',
          sending && 'opacity-70 pointer-events-none',
        )}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            !e.shiftKey &&
            (e.target as HTMLElement).tagName === 'INPUT'
          ) {
            e.preventDefault();
            if (!input.trim() || sending) return;
            void runAgent(input);
            setInput('');
          }
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="ask a follow-up or refine the plan…"
          className="flex-1 bg-transparent text-[15px] placeholder:text-ink-faint focus:outline-none text-ink"
        />
        <button
          type="button"
          onClick={() => {
            if (!input.trim() || sending) return;
            void runAgent(input);
            setInput('');
          }}
          aria-label="Send"
          className="w-10 h-10 rounded-xl text-white flex items-center justify-center shadow-md hover:shadow-glow hover:-translate-y-0.5 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:translate-y-0"
          style={{ background: 'var(--grad-violet)' }}
          disabled={!input.trim() || sending}
        >
          {sending ? <IconLoader2 size={16} className="animate-spin" /> : <IconArrowUp size={16} />}
        </button>
      </div>
    </div>
  );
}

function MessageRow({
  role,
  content,
  plan,
}: {
  role: 'user' | 'assistant';
  content: string;
  plan?: Record<string, unknown> | null;
}) {
  return (
    <div className="flex gap-3 stream-in">
      <div
        className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10',
        )}
        style={role === 'assistant' ? { background: 'var(--grad-violet)' } : undefined}
      >
        {role === 'assistant' ? (
          <IconSparkles size={15} className="text-white" />
        ) : (
          <IconUser size={15} className="text-ink-soft" />
        )}
      </div>
      <div className="flex-1 space-y-3 pt-1.5 min-w-0">
        <div className="text-[10px] font-semibold text-ink-soft uppercase tracking-widest">
          {role === 'assistant' ? 'Copilot' : 'You'}
        </div>
        {content && (
          <div className="text-[15px] leading-7 whitespace-pre-wrap">{content}</div>
        )}
        {plan && isPortfolio(plan) ? (
          <PortfolioPreview portfolio={plan} />
        ) : plan ? (
          <PlanPreview plan={plan as unknown as CampaignPlan} />
        ) : null}
      </div>
    </div>
  );
}

function LiveRow({ trace }: { trace: LiveTrace }) {
  return (
    <div className="flex gap-3 stream-in">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border border-white/10"
        style={{ background: 'var(--grad-violet)' }}
      >
        <IconSparkles size={15} className="text-white" />
      </div>
      <div className="flex-1 space-y-3 pt-1.5 min-w-0">
        <div className="flex items-center gap-2 text-[10px] font-semibold text-ink-soft uppercase tracking-widest">
          <span>Copilot</span>
          {!trace.done && (
            <span className="flex items-center gap-1 normal-case tracking-normal text-violet-300 text-[11px]">
              <IconLoader2 size={11} className="animate-spin" /> thinking
            </span>
          )}
        </div>
        {trace.reasoning && (
          <div className="text-[15px] leading-7 whitespace-pre-wrap">{trace.reasoning}</div>
        )}
        {trace.tools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {trace.tools.map((t) => (
              <ToolChip key={t.id} tool={t} />
            ))}
          </div>
        )}
        {trace.portfolio ? (
          <PortfolioPreview portfolio={trace.portfolio} />
        ) : trace.plan ? (
          <PlanPreview plan={trace.plan} />
        ) : null}
      </div>
    </div>
  );
}

function ToolChip({
  tool,
}: {
  tool: { id: string; name: string; args: unknown; result?: unknown; error?: string };
}) {
  return (
    <div
      className={cn(
        'font-mono text-[11px] px-2.5 py-1.5 rounded-lg border inline-flex items-center gap-1.5 transition-all stream-in backdrop-blur-sm',
        tool.error
          ? 'bg-danger/10 border-danger/30'
          : tool.result
            ? 'bg-success/8 border-success/30'
            : 'bg-white/[0.04] border-white/10',
      )}
    >
      {tool.error ? (
        <span className="w-1.5 h-1.5 rounded-full bg-danger" />
      ) : tool.result ? (
        <IconCheck size={11} className="text-success" />
      ) : (
        <IconLoader2 size={11} className="animate-spin text-violet-300" />
      )}
      <span className="text-violet-300">{tool.name}</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink-soft">
        {tool.error ? (
          <span className="text-danger">{tool.error.slice(0, 40)}</span>
        ) : tool.result ? (
          describeResult(tool.name, tool.result)
        ) : (
          'running…'
        )}
      </span>
    </div>
  );
}

function describeResult(name: string, result: unknown): string {
  const r = result as Record<string, unknown>;
  if (name === 'query_audience') return `${(r.size as number).toLocaleString('en-IN')} shoppers`;
  if (name === 'propose_channel_mix')
    return `${r.primary as string}${r.fallback ? ` → ${r.fallback as string}` : ''}`;
  if (name === 'draft_message') {
    const v = r as { channel: string; variantTag: string; body: string };
    return `${v.channel} · ${v.variantTag}`;
  }
  if (name === 'estimate_impact')
    return `~${r.expectedOrders} orders · ₹${(r.expectedRevenue as number).toLocaleString('en-IN')}`;
  if (name === 'finalize_plan') return 'plan ready';
  if (name === 'finalize_portfolio') {
    const p = r as { campaigns?: unknown[] };
    return `portfolio · ${(p.campaigns?.length ?? 0)} campaigns`;
  }
  return 'ok';
}
