import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HistoryList } from '@/components/HistoryList';
import { pct, tone } from '@/components/ProjectCard';
import { getHistory, getProjects } from '@/lib/data';
import { money } from '@/lib/format';
import { isAdminRole, requireMember } from '@/lib/session';

export const metadata: Metadata = { title: 'Project' };
export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile, company } = await requireMember();
  const project = (await getProjects(company.id)).find((p) => p.id === id);
  if (!project) notFound();
  const history = await getHistory(company.id, id);
  const admin = isAdminRole(profile.role);
  const cur = company.currency;

  return (
    <>
      <Link href="/projects" className="back">← All projects</Link>
      <div className="head">
        <div>
          <h1>{project.name}</h1>
          <p className="muted">{project.code}</p>
        </div>
        <div className="row">
          <Link href={`/expenses/new?project=${id}`} className="btn primary">+ Add expense</Link>
          {admin ? <Link href={`/funds/new?project=${id}`} className="btn soft">+ Add funds</Link> : null}
        </div>
      </div>

      <section className="hero">
        <div><span className="label">Budget</span><b>{money(project.budget, cur)}</b></div>
        <div><span className="label">Spent</span><b>{money(project.spent, cur)}</b></div>
        <div><span className="label">Remaining</span><b className={project.remaining < 0 ? 'neg' : ''}>{money(project.remaining, cur)}</b></div>
        <div className="bar wide"><i className={tone(project)} style={{ width: `${pct(project)}%` }} /></div>
      </section>

      <h2>History</h2>
      <div className="card flush">
        <HistoryList items={history} currency={cur} tz={company.timezone} />
      </div>
    </>
  );
}
