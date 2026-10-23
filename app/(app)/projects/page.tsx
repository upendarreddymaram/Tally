import type { Metadata } from 'next';
import Link from 'next/link';
import { ProjectCard } from '@/components/ProjectCard';
import { getProjects } from '@/lib/data';
import { money } from '@/lib/format';
import { isAdminRole, requireMember } from '@/lib/session';

export const metadata: Metadata = { title: 'Projects' };
export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const { profile, company } = await requireMember();
  const admin = isAdminRole(profile.role);
  const projects = await getProjects(company.id);
  const budget = projects.reduce((s, p) => s + p.budget, 0);
  const spent = projects.reduce((s, p) => s + p.spent, 0);

  return (
    <>
      <div className="head">
        <div>
          <h1>Projects</h1>
          <p className="muted">{company.name}</p>
        </div>
        {admin ? <Link href="/projects/new" className="btn dark">+ New project</Link> : null}
      </div>

      <section className="hero">
        <div><span className="label">Total budget</span><b>{money(budget, company.currency)}</b></div>
        <div><span className="label">Total spent</span><b>{money(spent, company.currency)}</b></div>
        <div><span className="label">Total remaining</span><b>{money(budget - spent, company.currency)}</b></div>
      </section>

      {projects.length ? (
        <div className="grid">
          {projects.map((p) => <ProjectCard key={p.id} p={p} currency={company.currency} admin={admin} />)}
        </div>
      ) : (
        <div className="empty big">
          <h3>No projects yet</h3>
          <p className="muted">{admin ? 'Create your first project and give it a budget.' : 'An admin needs to create a project first.'}</p>
          {admin ? <Link href="/projects/new" className="btn primary">+ New project</Link> : null}
        </div>
      )}
    </>
  );
}
