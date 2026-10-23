import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { getProjects } from '@/lib/queries';
import { ChangeBudgetForm } from './ChangeBudgetForm';

export const metadata: Metadata = { title: 'Change a budget' };

export default async function ChangeBudgetPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const { supabase, company, profile } = await requireAdmin();
  const projects = (await getProjects(supabase, company)).filter((p) => p.status === 'active');
  const pid = projects.some((p) => p.id === project) ? project! : projects[0]?.id;

  const [{ data: history }, { data: admins }] = await Promise.all([
    pid
      ? supabase
          .from('budget_changes')
          .select('id, kind, amount, budget_before, budget_after, status, created_at, project_id, target_project_id, requester:profiles!budget_changes_requested_by_fkey(full_name), signer:profiles!budget_changes_signed_off_by_fkey(full_name), project:projects!budget_changes_project_id_fkey(name), target:projects!budget_changes_target_project_id_fkey(name)')
          .or(`project_id.eq.${pid},target_project_id.eq.${pid}`)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('full_name').in('role', ['owner', 'admin']).eq('active', true).neq('id', profile.id)
  ]);

  return (
    <ChangeBudgetForm
      currency={company.currency}
      signoffAbove={Number(company.signoff_above)}
      signer={(admins ?? [])[0]?.full_name ?? null}
      projects={projects.map((p) => ({ id: p.id, name: p.name, code: p.code, budget: p.budget, spent: p.spent, held: p.held }))}
      projectId={pid ?? ''}
      history={(history ?? []) as never}
      tz={company.timezone}
    />
  );
}
