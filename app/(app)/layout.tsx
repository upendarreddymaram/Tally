import { Shell } from '@/components/Sidebar';
import type { NavItem } from '@/components/NavLinks';
import { canApproveRole, isAdminRole, requireMember } from '@/lib/session';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profile, company } = await requireMember();
  const admin = isAdminRole(profile.role);
  const approver = canApproveRole(profile.role);

  let items: NavItem[];
  if (approver) {
    const [pending, signoffs, owed] = await Promise.all([
      supabase.from('expenses').select('id', { count: 'exact', head: true }).in('status', ['pending']),
      admin
        ? supabase.from('budget_changes').select('id', { count: 'exact', head: true }).eq('status', 'pending').neq('requested_by', profile.id)
        : Promise.resolve({ count: 0 }),
      admin
        ? supabase.from('expenses').select('submitted_by').eq('pay_method', 'own_money').in('status', ['approved', 'part_approved']).is('reimbursed_at', null)
        : Promise.resolve({ data: [] as { submitted_by: string }[] })
    ]);
    const owedPeople = new Set(((owed as { data: { submitted_by: string }[] | null }).data ?? []).map((r) => r.submitted_by)).size;
    items = [
      { label: 'Overview', href: '/overview', icon: 'overview', group: 'Money' },
      { label: 'Projects', href: '/projects', icon: 'projects' },
      { label: 'Approvals', href: '/approvals', icon: 'approvals', badge: pending.count ?? 0 },
      { label: 'All expenses', href: '/expenses', icon: 'expenses' },
      ...(admin
        ? ([
            { label: 'Budget changes', href: '/budget-changes', icon: 'changes', badge: signoffs.count ?? 0 },
            { label: 'Reimbursements', href: '/reimbursements', icon: 'payouts', badge: owedPeople }
          ] as NavItem[])
        : []),
      { label: 'My claims', href: '/my', icon: 'mine' },
      { label: 'Reports', href: '/reports', icon: 'reports', group: 'Control' },
      ...(admin
        ? ([
            { label: 'Team & roles', href: '/team', icon: 'team' },
            { label: 'Audit log', href: '/audit', icon: 'audit' },
            { label: 'Settings', href: '/settings', icon: 'settings' }
          ] as NavItem[])
        : [])
    ];
  } else {
    items = [{ label: 'My claims', href: '/my', icon: 'mine' }];
  }

  return (
    <Shell company={company} profile={profile} items={items}>
      {children}
    </Shell>
  );
}
