import type { Metadata } from 'next';
import Link from 'next/link';
import { requireMember } from '@/lib/session';
import { NewClaimForm } from './NewClaimForm';

export const metadata: Metadata = { title: 'New claim' };

export default async function NewClaimPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const { project } = await searchParams;
  const { supabase, company } = await requireMember();
  const [{ data: balances }, { data: cats }] = await Promise.all([supabase.rpc('my_project_balances'), supabase.from('categories').select('id, name').order('name')]);
  const projects = ((balances ?? []) as { project_id: string; name: string }[]).map((b) => ({ id: b.project_id, name: b.name }));
  return (
    <div className="col main-narrow" style={{ gap: 22 }}>
      <nav aria-label="Breadcrumb" className="crumbs"><Link href="/my">My claims</Link><span aria-hidden="true">/</span><span style={{ color: 'var(--ink)' }}>New claim</span></nav>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="h1">New claim</h1>
        <span className="muted">Photograph the receipt and say what it was for. Receipts are required above {company.currency} {Number(company.receipt_required_above).toLocaleString('en-US')}.</span>
      </div>
      {projects.length ? (
        <NewClaimForm companyId={company.id} currency={company.currency} projects={projects} categories={cats ?? []} initialProject={projects.some((p) => p.id === project) ? project! : projects[0]!.id} />
      ) : (
        <div className="card empty">You’re not on any project yet. Ask your admin to add you.</div>
      )}
    </div>
  );
}
