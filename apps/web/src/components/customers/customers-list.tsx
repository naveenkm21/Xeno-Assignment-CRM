'use client';
import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import {
  IconSearch,
  IconArrowUpRight,
  IconMapPin,
  IconLoader2,
  IconMoodEmpty,
} from '@tabler/icons-react';

type CustomerRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  city: string;
  ltv: number;
  orderCount: number;
  lastOrderAt: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function CustomersList() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useSWR<{ customers: CustomerRow[] }>(
    `/api/customers?q=${encodeURIComponent(q)}`,
    fetcher,
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  return (
    <div className="space-y-4">
      <div className="surface-raised flex items-center gap-3 px-4 py-3">
        <IconSearch size={16} className="text-ink-faint flex-shrink-0" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search by name, email, city…"
          className="flex-1 bg-transparent text-[14.5px] placeholder:text-ink-faint focus:outline-none"
        />
        {isLoading && <IconLoader2 size={14} className="animate-spin text-ink-faint" />}
      </div>

      {data?.customers.length === 0 ? (
        <div className="surface p-12 text-center">
          <IconMoodEmpty size={28} className="text-ink-faint mx-auto mb-3" />
          <div className="text-sm font-medium">no matches</div>
          <div className="text-xs text-ink-soft mt-1">try a different name or city</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data?.customers.map((c) => (
            <Link
              key={c.id}
              href={`/customers/${c.id}`}
              className="surface p-4 glow-hover group flex items-center gap-3"
            >
              <Avatar firstName={c.firstName} lastName={c.lastName} />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {c.firstName} {c.lastName}
                </div>
                <div className="text-[11px] text-ink-faint flex items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1">
                    <IconMapPin size={10} />
                    {c.city}
                  </span>
                  <span>·</span>
                  <span className="tabular-nums">
                    ₹{Math.round(c.ltv).toLocaleString('en-IN')} LTV
                  </span>
                  <span>·</span>
                  <span className="tabular-nums">{c.orderCount} orders</span>
                </div>
              </div>
              <IconArrowUpRight
                size={14}
                className="text-ink-faint group-hover:text-ink group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all flex-shrink-0"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  const colors = ['var(--grad-violet)', 'var(--grad-cyan)', 'var(--grad-warm)', 'var(--grad-lime)'];
  const idx = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % colors.length;
  return (
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-xs text-white flex-shrink-0 shadow-sm"
      style={{ background: colors[idx] }}
    >
      {initials}
    </div>
  );
}
