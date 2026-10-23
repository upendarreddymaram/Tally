import type { Metadata } from 'next';
import Link from 'next/link';
import { HistoryList } from '@/components/HistoryList';
import { getHistory, getProjects } from '@/lib/data';
import { money } from '@/lib/format';
import { requireMember } from '@/lib/session';

export const metadata: Metadata = { title: 'History' };
export const dynamic = 'force-dynamic';

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const { company } = await requireMember();
  const [projects, items] = await Promise.all([getProjects(company.id), getHistory(company.id, project)]);
  const out = items.filter((i) => i.kind === 'expense').reduce((s, i) => s + i.amount, 0);
  const inn = items.filter((i) => i.kind === 'funds').reduce((s, i) => s + i.amount, 0);

  return (
    <>
      <div className="head">
        <div>
          <h1>History</h1>
          <p className="muted">Every budget top-up and expense, newest first.</p>
        </div>
      </div>
      <div className="chips">
        <Link href="/history" aria-current={!project ? 'true' : undefined}>All projects</Link>
        {projects.map((p) => (
          <Link key={p.id} href={`/history?project=${p.id}`} aria-current={project === p.id ? 'true' : undefined}>{p.name}</Link>
        ))}
      </div>
      <section className="hero">
        <div><span className="label">Funds in</span><b>{money(inn, company.currency)}</b></div>
        <div><span className="label">Expenses</span><b>{money(out, company.currency)}</b></div>
        <div><span className="label">Entries</span><b>{items.length}</b></div>
      </section>
      <div className="card flush">
        <HistoryList items={items} currency={company.currency} tz={company.timezone} showProject />
      </div>
    </>
  );
}
