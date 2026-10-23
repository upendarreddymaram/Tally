import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getProjects } from '@/lib/data';
import { isAdminRole, requireMember } from '@/lib/session';
import { FundsForm } from './FundsForm';

export const metadata: Metadata = { title: 'Add funds' };
export const dynamic = 'force-dynamic';

export default async function NewFundsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const { profile, company } = await requireMember();
  if (!isAdminRole(profile.role)) redirect('/projects');
  const projects = await getProjects(company.id);
  if (!projects.length) redirect('/projects/new');
  return (
    <div className="narrow">
      <Link href="/projects" className="back">← Projects</Link>
      <h1>Add funds</h1>
      <p className="muted">Top up a project’s budget. Proof is required.</p>
      <FundsForm
        companyId={company.id}
        currency={company.currency}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        initialProject={project && projects.some((p) => p.id === project) ? project : projects[0]!.id}
      />
    </div>
  );
}
