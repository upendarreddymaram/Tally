import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import type { Profile } from '@/lib/types';
import { NewProjectForm } from './NewProjectForm';

export const metadata: Metadata = { title: 'New project' };

export default async function NewProjectPage() {
  const { supabase, company, profile } = await requireAdmin();
  const [{ data: people }, { data: codes }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, last_seen_at').eq('active', true).order('full_name'),
    supabase.from('projects').select('code')
  ]);
  const maxNum = (codes ?? []).reduce((m, c) => Math.max(m, parseInt(String(c.code).replace(/\D/g, ''), 10) || 0), 0);
  const nextCode = `PRJ-${String(maxNum + 1).padStart(4, '0')}`;

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/projects">Projects</Link><span aria-hidden="true">/</span><span style={{ color: 'var(--ink)' }}>New project</span>
      </nav>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="h1">Set up a project</h1>
        <span className="muted">Name it, put money in with proof, choose who can spend and the rules they spend under.</span>
      </div>
      <NewProjectForm
        companyId={company.id}
        currency={company.currency}
        me={profile.id}
        nextCode={nextCode}
        people={(people ?? []) as Pick<Profile, 'id' | 'full_name' | 'role' | 'last_seen_at'>[]}
        defaults={{
          receipt: Number(company.receipt_required_above),
          auto: Number(company.auto_approve_up_to),
          admin: Number(company.admin_approval_above),
          alert: Number(company.alert_below_pct),
          limit: Number(company.default_monthly_limit),
          workersSee: company.workers_see_balance
        }}
      />
    </>
  );
}
