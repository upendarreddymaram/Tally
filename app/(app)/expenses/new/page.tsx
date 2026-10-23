import type { Metadata } from 'next';
import Link from 'next/link';
import { getProjects } from '@/lib/data';
import { requireMember } from '@/lib/session';
import { ExpenseForm } from './ExpenseForm';

export const metadata: Metadata = { title: 'Add expense' };
export const dynamic = 'force-dynamic';

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const { company } = await requireMember();
  const projects = await getProjects(company.id);
  return (
    <div className="narrow">
      <Link href="/projects" className="back">← Projects</Link>
      <h1>Add expense</h1>
      <p className="muted">The date and time are saved automatically when you submit.</p>
      {projects.length ? (
        <ExpenseForm
          companyId={company.id}
          currency={company.currency}
          tz={company.timezone}
          projects={projects.map((p) => ({ id: p.id, name: p.name, remaining: p.remaining }))}
          initialProject={project && projects.some((p) => p.id === project) ? project : projects[0]!.id}
        />
      ) : (
        <div className="empty big"><p className="muted">There are no projects yet. An admin needs to create one first.</p></div>
      )}
    </div>
  );
}
