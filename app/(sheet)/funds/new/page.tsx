import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { getProjects } from '@/lib/queries';
import { AddFundsForm } from './AddFundsForm';

export const metadata: Metadata = { title: 'Add funds' };

export default async function AddFundsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const { supabase, company, profile } = await requireAdmin();
  const projects = (await getProjects(supabase, company)).filter((p) => p.status === 'active');
  return (
    <AddFundsForm
      companyId={company.id}
      currency={company.currency}
      me={profile.full_name}
      projects={projects.map((p) => ({ id: p.id, name: p.name, left: p.left }))}
      initialProject={projects.some((p) => p.id === project) ? project! : projects[0]?.id ?? ''}
      today={new Date().toISOString().slice(0, 10)}
    />
  );
}
