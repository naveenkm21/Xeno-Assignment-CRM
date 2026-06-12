import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import {
  IconSparkles,
  IconArrowRight,
  IconBrandGithub,
  IconMessage,
  IconBolt,
  IconChartBar,
  IconBrandWhatsapp,
  IconCheck,
} from '@tabler/icons-react';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function Landing() {
  const { userId } = await auth();
  if (userId) redirect('/home');

  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Features />
      <Footer />
    </div>
  );
}

function BrandMark({ size = 8 }: { size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-xl flex items-center justify-center shadow-sm`}
      style={{ background: 'var(--grad-violet)' }}
    >
      <IconSparkles size={size * 2} className="text-white" />
    </div>
  );
}

function Nav() {
  return (
    <header className="surface-glass sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <BrandMark />
          <span className="text-[15px]">Xeno Copilot</span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <a
            href="https://github.com/naveenkm21/Xeno-Assignment-CRM"
            className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg text-ink-soft hover:text-ink hover:bg-muted transition-all"
            target="_blank"
            rel="noreferrer"
          >
            <IconBrandGithub size={16} />
            <span className="text-sm">GitHub</span>
          </a>
          <Link
            href="/sign-in"
            className="px-3 py-2 rounded-lg text-ink-soft hover:text-ink hover:bg-muted transition-all text-sm"
          >
            Sign in
          </Link>
          <Link href="/sign-up" className="btn-primary !py-2 !px-4 text-[13px] ml-1">
            Get started <IconArrowRight size={13} />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative px-6 pt-20 md:pt-28 pb-20 text-center overflow-hidden">
      {/* Background layers — grid first, then plus marks, then color halo */}
      <div className="grid-pattern" />
      <div className="grid-plus" />
      <div className="hero-halo" />
      <div className="relative max-w-6xl mx-auto">
        <div className="reveal reveal-1 inline-flex items-center gap-2 chip pill-violet !py-1.5 !px-3.5 mb-8">
          <span className="dot-live !w-1.5 !h-1.5" />
          <span className="font-medium">AI-native CRM · for D2C brands</span>
        </div>

        <h1 className="reveal reveal-2 text-[40px] sm:text-[56px] md:text-[72px] font-semibold tracking-[-0.04em] max-w-4xl mx-auto leading-[1.05]">
          The CRM that actually
          <br />
          <span className="text-gradient">does the work.</span>
        </h1>

        <p className="reveal reveal-3 mt-7 text-lg text-ink-soft max-w-xl mx-auto leading-relaxed">
          Tell the copilot what you want — it finds the audience, drafts the message, picks the
          channel, sends, and reports back.
        </p>

        <div className="reveal reveal-3 mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/sign-up" className="btn-primary !py-3 !px-6 text-[15px]">
            Start free <IconArrowRight size={16} />
          </Link>
          <Link href="/sign-in" className="btn-secondary !py-3 !px-6 text-[15px]">
            Sign in
          </Link>
        </div>

        <div className="reveal reveal-4 mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <IconCheck size={12} className="text-success" /> Free tier
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconCheck size={12} className="text-success" /> No credit card
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconCheck size={12} className="text-success" /> Sub-second agent
          </span>
        </div>

        <ChatDemo />
      </div>
    </section>
  );
}

function ChatDemo() {
  return (
    <div className="reveal reveal-5 mt-20 max-w-xl mx-auto relative">
      <div className="surface-floating !p-0 overflow-hidden text-left">
        <div className="px-5 py-3 border-b border-border flex items-center gap-2 text-xs">
          <BrandMark size={5} />
          <span className="font-medium">Copilot</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-ink-soft">
            <span className="dot-live !w-1.5 !h-1.5" /> live
          </span>
        </div>

        <div className="px-5 py-5 space-y-5">
          <div className="flex gap-3 stream-in">
            <div className="w-7 h-7 rounded-lg bg-muted border border-border flex items-center justify-center text-[11px] font-semibold flex-shrink-0">
              N
            </div>
            <div className="text-[14px] leading-7 pt-0.5 text-ink-soft">
              Bring back customers who haven&apos;t ordered in 60+ days.
            </div>
          </div>

          <div className="flex gap-3 stream-in" style={{ animationDelay: '0.25s' }}>
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ background: 'var(--grad-violet)' }}
            >
              <IconSparkles size={12} className="text-white" />
            </div>
            <div className="flex-1 space-y-3 pt-0.5">
              <div className="text-[14px] leading-7">Here&apos;s the plan.</div>

              <div className="flex flex-wrap gap-1.5">
                <ToolChip name="query_audience" result="4,820 shoppers" />
                <ToolChip name="propose_channel_mix" result="WhatsApp" />
              </div>

              <div className="surface !p-3.5 text-[13px] leading-6">
                <div className="text-[10px] uppercase tracking-widest text-ink-soft mb-1.5 flex items-center gap-1.5 font-semibold">
                  <IconBrandWhatsapp size={11} className="text-success" /> WhatsApp · variant A
                </div>
                Hey Riya, your last cup with us was a while back ☕ Here&apos;s 15% off your next bag —
                code <span className="font-mono font-semibold text-accent">BACK15</span>.
              </div>

              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <span className="chip pill-violet">4,820 shoppers</span>
                <span className="chip pill-cyan">WhatsApp</span>
                <span className="chip pill-amber">Sat 11 AM IST</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolChip({ name, result }: { name: string; result: string }) {
  return (
    <div className="font-mono text-[10.5px] px-2 py-1 rounded-md border border-border inline-flex items-center gap-1.5 bg-muted">
      <IconCheck size={10} className="text-success" />
      <span className="text-accent">{name}</span>
      <span className="text-ink-faint">·</span>
      <span className="text-ink-soft">{result}</span>
    </div>
  );
}

function Features() {
  const items = [
    {
      icon: IconMessage,
      title: 'Chat is the builder',
      body:
        'No drag-and-drop, no segment trees. Brief the copilot in plain English; it proposes the audience, drafts the message, picks the channel.',
    },
    {
      icon: IconBolt,
      title: 'Real channel modeling',
      body:
        'A separate stubbed channel service runs a callback-driven send loop — idempotent, retried, HMAC-signed. Built for the spec, not faked.',
    },
    {
      icon: IconChartBar,
      title: 'Live performance, narrated',
      body:
        'Funnel updates in real time as receipts stream in. When the campaign closes, the copilot summarises what worked and what to run next.',
    },
  ];
  return (
    <section className="relative px-6 py-24 border-t border-border overflow-hidden">
      <div className="dot-pattern" />
      <div className="relative max-w-6xl mx-auto">
      <div className="text-center mb-14">
        <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.035em] max-w-2xl mx-auto leading-[1.05]">
          One opinionated bet, executed.
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.title}
              className="surface p-7 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
            >
              <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center mb-5">
                <Icon size={18} className="text-accent" />
              </div>
              <h3 className="font-semibold text-[17px] mb-2 tracking-tight">{it.title}</h3>
              <p className="text-[14px] text-ink-soft leading-relaxed">{it.body}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-16 surface-glow relative overflow-hidden p-10 md:p-14 text-center">
        <div className="hero-halo" />
        <div className="relative">
          <h3 className="text-2xl md:text-4xl font-semibold tracking-[-0.035em] max-w-xl mx-auto leading-tight">
            Stop building campaigns.
            <br />
            <span className="text-gradient">Start briefing them.</span>
          </h3>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link href="/sign-up" className="btn-primary !py-3 !px-6 text-[15px]">
              Get started <IconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-ink-soft">
        <div className="flex items-center gap-2">
          <BrandMark size={5} />
          <span className="font-medium">Xeno Copilot</span>
          <span className="text-ink-faint">· take-home, 2026</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="#" className="hover:text-ink transition-colors">Privacy</a>
          <a href="#" className="hover:text-ink transition-colors">Terms</a>
          <a
            href="https://github.com/naveenkm21/Xeno-Assignment-CRM"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink transition-colors inline-flex items-center gap-1.5"
          >
            <IconBrandGithub size={13} /> GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
