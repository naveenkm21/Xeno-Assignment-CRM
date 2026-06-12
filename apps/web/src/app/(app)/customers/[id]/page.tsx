import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db, customers } from '@xeno/db';
import { eq } from 'drizzle-orm';
import { IconArrowLeft } from '@tabler/icons-react';
import { CustomerInspector } from '@/components/customers/customer-inspector';

export const dynamic = 'force-dynamic';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [exists] = await db.select({ id: customers.id }).from(customers).where(eq(customers.id, id)).limit(1);
  if (!exists) notFound();

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-xs text-ink-soft hover:text-ink transition-colors"
      >
        <IconArrowLeft size={13} /> all customers
      </Link>
      <CustomerInspector customerId={id} />
    </div>
  );
}
