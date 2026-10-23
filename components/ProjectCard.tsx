import Link from 'next/link';
import { money } from '@/lib/format';
import type { ProjectRow } from '@/lib/data';

export function pct(p: { budget: number; spent: number }) {
  return p.budget > 0 ? Math.min(100, (p.spent / p.budget) * 100) : 0;
}
export const tone = (p: { budget: number; spent: number }) => (p.spent >= p.budget ? 'bad' : p.spent / (p.budget || 1) >= 0.8 ? 'warn' : 'ok');

export function ProjectCard({ p, currency, admin }: { p: ProjectRow; currency: string; admin: boolean }) {
  return (
    <article className="card project">
      <Link href={`/projects/${p.id}`} className="project-head">
        <div>
          <h3>{p.name}</h3>
          <span className="muted small">{p.code}</span>
        </div>
        <span className={`pill ${tone(p)}`}>{p.remaining < 0 ? 'Over budget' : `${money(p.remaining, currency)} left`}</span>
      </Link>
      <div className="bar"><i className={tone(p)} style={{ width: `${pct(p)}%` }} /></div>
      <div className="trio">
        <div><span className="label">Budget</span><b>{money(p.budget, currency)}</b></div>
        <div><span className="label">Spent</span><b>{money(p.spent, currency)}</b></div>
        <div><span className="label">Remaining</span><b className={p.remaining < 0 ? 'neg' : ''}>{money(p.remaining, currency)}</b></div>
      </div>
      <div className="row">
        <Link className="btn primary sm" href={`/expenses/new?project=${p.id}`}>+ Expense</Link>
        {admin ? <Link className="btn soft sm" href={`/funds/new?project=${p.id}`}>+ Funds</Link> : null}
        <Link className="btn ghost sm" href={`/projects/${p.id}`}>Open</Link>
      </div>
    </article>
  );
}
