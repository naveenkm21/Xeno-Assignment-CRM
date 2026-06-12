import { CustomersList } from '@/components/customers/customers-list';

export const dynamic = 'force-dynamic';

export default function CustomersPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <header>
        <div className="chip pill-violet inline-flex !py-1 !px-2.5 mb-3">customers</div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-[-0.04em]">
          every shopper, <span className="text-gradient">inspectable.</span>
        </h1>
        <p className="text-sm text-ink-soft mt-2">
          click any customer to see their full lifetime — orders, comms, every state transition.
        </p>
      </header>
      <CustomersList />
    </div>
  );
}
