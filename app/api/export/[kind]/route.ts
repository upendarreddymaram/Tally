import { NextResponse, type NextRequest } from 'next/server';
import { getSession, canApproveRole, isAdminRole } from '@/lib/session';
import { getProjects } from '@/lib/queries';
import { csv, FUND_METHOD_LABEL, PAY_METHOD_LABEL, periodStart, STATUS_LABEL } from '@/lib/format';

const iso = (s: string | null | undefined) => (s ? new Date(s).toISOString().replace('T', ' ').slice(0, 16) : '');

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const { supabase, profile, company } = await getSession();
  if (!profile || !company || !canApproveRole(profile.role)) return new NextResponse('Not allowed', { status: 403 });
  const sp = request.nextUrl.searchParams;
  let rows: (string | number | null)[][] = [];

  if (kind === 'projects') {
    const ps = await getProjects(supabase, company);
    rows = [['Code', 'Project', 'Status', 'Lead', 'Budget', 'Spent', 'Held', 'Left', 'Runway days']];
    for (const p of ps) rows.push([p.code, p.name, p.status, p.lead_name, p.budget, p.spent, p.held, p.left, p.runway]);
  } else if (kind === 'expenses' || kind === 'ledger') {
    let q = supabase
      .from('expenses')
      .select('ref, title, vendor, amount, approved_amount, status, paid_at, created_at, decided_at, pay_method, card_last4, flags, reimbursed_at, submitter:profiles!expenses_submitted_by_fkey(full_name), project:projects(name), category:categories(name)')
      .order('paid_at', { ascending: false })
      .limit(10000);
    const projectId = sp.get('project');
    if (projectId) q = q.eq('project_id', projectId);
    const start = kind === 'expenses' ? periodStart(sp.get('period') ?? 'month') : null;
    if (start) q = q.gte('paid_at', start.toISOString());
    if (sp.get('status')) q = q.eq('status', sp.get('status')!);
    if (sp.get('category')) q = q.eq('category_id', sp.get('category')!);
    const { data } = await q;
    rows = [['Claim', 'Expense', 'Supplier', 'Worker', 'Project', 'Category', 'Paid on', 'Paid with', 'Claimed', 'Approved', 'Status', 'Flags', 'Decided', 'Reimbursed']];
    for (const e of (data ?? []) as unknown as Record<string, never>[]) {
      const r = e as unknown as { ref: string; title: string; vendor: string | null; amount: number; approved_amount: number | null; status: string; paid_at: string; decided_at: string | null; pay_method: string; card_last4: string | null; flags: string[]; reimbursed_at: string | null; submitter: { full_name: string } | null; project: { name: string } | null; category: { name: string } | null };
      rows.push([r.ref, r.title, r.vendor, r.submitter?.full_name ?? '', r.project?.name ?? '', r.category?.name ?? '', iso(r.paid_at), PAY_METHOD_LABEL[r.pay_method] + (r.card_last4 ? ` ${r.card_last4}` : ''), r.amount, r.approved_amount, STATUS_LABEL[r.status] ?? r.status, (r.flags ?? []).join('; '), iso(r.decided_at), iso(r.reimbursed_at)]);
    }
    if (kind === 'ledger' && projectId && isAdminRole(profile.role)) {
      const { data: funds } = await supabase.from('funding').select('ref, amount, method, reference, received_on, proof_name, note').eq('project_id', projectId);
      rows.push([], ['Funding ref', 'Method', 'Reference', 'Received', 'Proof', 'Note', 'Amount']);
      for (const f of funds ?? []) rows.push([f.ref, FUND_METHOD_LABEL[f.method] ?? f.method, f.reference, f.received_on, f.proof_name, f.note, f.amount]);
    }
  } else if (kind === 'changes' && isAdminRole(profile.role)) {
    const { data } = await supabase
      .from('budget_changes')
      .select('created_at, kind, amount, budget_before, budget_after, reason, reference, note, status, requester:profiles!budget_changes_requested_by_fkey(full_name), signer:profiles!budget_changes_signed_off_by_fkey(full_name), project:projects!budget_changes_project_id_fkey(name), target:projects!budget_changes_target_project_id_fkey(name)')
      .order('created_at', { ascending: false });
    rows = [['When', 'Project', 'Moved to', 'Type', 'Amount', 'Budget before', 'Budget after', 'Reason', 'Reference', 'Note', 'Status', 'By', 'Signed off by']];
    for (const c of (data ?? []) as unknown as { created_at: string; kind: string; amount: number; budget_before: number; budget_after: number; reason: string; reference: string; note: string; status: string; requester: { full_name: string } | null; signer: { full_name: string } | null; project: { name: string } | null; target: { name: string } | null }[]) {
      rows.push([iso(c.created_at), c.project?.name ?? '', c.target?.name ?? '', c.kind, c.amount, c.budget_before, c.budget_after, c.reason, c.reference, c.note, c.status, c.requester?.full_name ?? '', c.signer?.full_name ?? '']);
    }
  } else if (kind === 'audit' && isAdminRole(profile.role)) {
    const { data } = await supabase.from('audit_log').select('created_at, kind, text, ref, source, actor:profiles(full_name)').order('created_at', { ascending: false }).limit(20000);
    rows = [['When', 'Who', 'Type', 'Event', 'Reference', 'Source']];
    for (const a of (data ?? []) as unknown as { created_at: string; kind: string; text: string; ref: string | null; source: string; actor: { full_name: string } | null }[]) {
      rows.push([iso(a.created_at), a.actor?.full_name ?? 'Tally', a.kind, a.text, a.ref, a.source]);
    }
  } else {
    return new NextResponse('Not found', { status: 404 });
  }

  const name = `tally-${kind}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse('﻿' + csv(rows), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` }
  });
}
