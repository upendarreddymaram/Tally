import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Icon, PlusChip } from '@/components/Icon';
import { requireApprover, isAdminRole } from '@/lib/session';
import { getProjects, rule, runwayText, signedUrls } from '@/lib/queries';
import { dayMonth, fullDate, FUND_METHOD_LABEL, initials, money, PAY_METHOD_LABEL, shortName, STATUS_LABEL, time, whole } from '@/lib/format';
import { ProjectMenu, MemberLimit, RulesForm, AddMemberForm } from './ProjectClient';

export const metadata: Metadata = { title: 'Project' };

type Tab = 'ledger' | 'expenses' | 'funding' | 'changes' | 'rules';
type Filter = 'all' | 'in' | 'out' | 'held';

type Entry = {
  at: string; type: 'IN' | 'OUT' | 'HELD' | 'MOVE'; title: string; sub: string; by: string; proof: string; proofUrl?: string;
  inAmt: number; outAmt: number; held?: boolean; bal?: number; href?: string;
};

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; filter?: string; more?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase, profile, company } = await requireApprover();
  const admin = isAdminRole(profile.role);
  const tz = company.timezone;
  const cur = company.currency;
  const [project] = await getProjects(supabase, company, { id });
  if (!project) notFound();

  const tab: Tab = (['ledger', 'expenses', 'funding', 'changes', 'rules'] as const).includes(sp.tab as Tab) ? (sp.tab as Tab) : 'ledger';
  const filter: Filter = (['all', 'in', 'out', 'held'] as const).includes(sp.filter as Filter) ? (sp.filter as Filter) : 'all';
  const limit = Math.min(500, Math.max(10, parseInt(sp.more ?? '30', 10) || 30));

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [expRes, fundRes, chgRes, memRes, peopleRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, ref, title, amount, approved_amount, status, flags, created_at, decided_at, paid_at, pay_method, decision_reason, decision_note, auto_approved, submitted_by, submitter:profiles!expenses_submitted_by_fkey(full_name), decider:profiles!expenses_decided_by_fkey(full_name), expense_files(path, name)')
      .eq('project_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('funding').select('id, ref, amount, method, reference, received_on, proof_path, proof_name, note, created_at, creator:profiles!funding_created_by_fkey(full_name)').eq('project_id', id).order('created_at', { ascending: false }),
    supabase
      .from('budget_changes')
      .select('id, kind, amount, budget_before, budget_after, target_before, target_after, project_id, target_project_id, reason, reference, note, status, created_at, decided_at, decline_note, requester:profiles!budget_changes_requested_by_fkey(full_name), signer:profiles!budget_changes_signed_off_by_fkey(full_name), project:projects!budget_changes_project_id_fkey(name), target:projects!budget_changes_target_project_id_fkey(name)')
      .or(`project_id.eq.${id},target_project_id.eq.${id}`)
      .order('created_at', { ascending: false }),
    supabase.from('project_members').select('user_id, monthly_limit, member:profiles(id, full_name, role, last_seen_at)').eq('project_id', id),
    admin ? supabase.from('profiles').select('id, full_name').eq('active', true).order('full_name') : Promise.resolve({ data: [] })
  ]);

  type Exp = {
    id: string; ref: string; title: string; amount: number; approved_amount: number | null; status: string; flags: string[]; created_at: string; decided_at: string | null;
    paid_at: string; pay_method: string; decision_reason: string | null; decision_note: string | null; auto_approved: boolean; submitted_by: string;
    submitter: { full_name: string } | null; decider: { full_name: string } | null; expense_files: { path: string; name: string }[];
  };
  type Fund = { id: string; ref: string; amount: number; method: string; reference: string | null; received_on: string; proof_path: string; proof_name: string | null; note: string | null; created_at: string; creator: { full_name: string } | null };
  type Chg = {
    id: string; kind: string; amount: number; budget_before: number; budget_after: number; target_before: number | null; target_after: number | null; project_id: string; target_project_id: string | null;
    reason: string | null; reference: string | null; note: string | null; status: string; created_at: string; decided_at: string | null; decline_note: string | null;
    requester: { full_name: string } | null; signer: { full_name: string } | null; project: { name: string } | null; target: { name: string } | null;
  };
  const expenses = (expRes.data ?? []) as unknown as Exp[];
  const funding = (fundRes.data ?? []) as unknown as Fund[];
  const changes = (chgRes.data ?? []) as unknown as Chg[];
  const members = (memRes.data ?? []) as unknown as { user_id: string; monthly_limit: number; member: { id: string; full_name: string; role: string; last_seen_at: string | null } | null }[];

  // ---------- Ledger ----------
  const entries: Entry[] = [];
  for (const f of funding) {
    entries.push({
      at: f.created_at, type: 'IN', title: f.note === 'Opening budget' ? 'Opening budget' : `Funds added — ${FUND_METHOD_LABEL[f.method]?.toLowerCase()}`,
      sub: [f.reference ? `Ref ${f.reference}` : null, f.note && f.note !== 'Opening budget' ? f.note : null, f.ref].filter(Boolean).join(' · '),
      by: shortName(f.creator?.full_name), proof: 'Slip', proofUrl: f.proof_path, inAmt: Number(f.amount), outAmt: 0
    });
  }
  for (const c of changes.filter((c) => c.status === 'applied' && ['increase', 'decrease', 'move', 'set'].includes(c.kind))) {
    const incoming = c.target_project_id === id;
    const delta = incoming ? Number(c.amount) : Number(c.budget_after) - Number(c.budget_before);
    const signed = c.signer ? ` · second sign-off by ${c.signer.full_name}` : '';
    entries.push({
      at: c.decided_at ?? c.created_at, type: 'MOVE',
      title: c.kind === 'move' ? (incoming ? `Moved in from ${c.project?.name}` : `Moved out to ${c.target?.name}`) : `Budget ${c.kind === 'set' ? 'set' : c.kind + 'd'} · ${whole(c.budget_before)} → ${whole(c.budget_after)}`,
      sub: `Reason: ${c.reason ?? '—'}${c.note ? ' — ' + c.note : ''}${signed}`,
      by: shortName(c.requester?.full_name), proof: c.reference ? c.reference : 'Note',
      inAmt: delta > 0 ? delta : 0, outAmt: delta < 0 ? -delta : 0
    });
  }
  for (const e of expenses) {
    const files = e.expense_files?.length ?? 0;
    const base = { by: shortName(e.submitter?.full_name), proof: files ? `${files} file${files > 1 ? 's' : ''}` : 'None', proofUrl: e.expense_files?.[0]?.path, href: `/approvals?id=${e.id}`, inAmt: 0 };
    if (e.status === 'approved' || e.status === 'part_approved') {
      const sub =
        e.status === 'part_approved'
          ? `Part-approved ${money(e.approved_amount)} of ${money(e.amount)}${e.decision_reason ? ' — ' + e.decision_reason : ''}`
          : e.auto_approved
            ? `Auto-approved · under ${cur} ${whole(rule(project, company, 'auto_approve_up_to'))} with receipt`
            : `Approved by ${e.decider?.full_name ?? '—'}`;
      entries.push({ ...base, at: e.decided_at ?? e.created_at, type: 'OUT', title: e.title, sub, outAmt: Number(e.approved_amount) });
    } else if (e.status === 'pending' || e.status === 'info_requested') {
      const sub = e.status === 'info_requested' ? `You asked: ${e.decision_note ?? ''} · no reply yet` : `Waiting for approval${e.flags?.length ? ' · ' + e.flags.join(', ').toLowerCase() : ''}`;
      entries.push({ ...base, at: e.created_at, type: 'HELD', title: e.title, sub, outAmt: Number(e.amount), held: true });
    }
  }
  entries.sort((a, b) => a.at.localeCompare(b.at));
  let bal = 0;
  for (const en of entries) {
    if (!en.held) {
      bal += en.inAmt - en.outAmt;
      en.bal = bal;
    }
  }
  entries.reverse();
  const filtered = entries.filter((e) => filter === 'all' || (filter === 'in' && (e.type === 'IN' || (e.type === 'MOVE' && e.inAmt > 0))) || (filter === 'out' && (e.type === 'OUT' || (e.type === 'MOVE' && e.outAmt > 0))) || (filter === 'held' && e.held));
  const shown = filtered.slice(0, limit);
  const urls = await signedUrls(supabase, [...shown.map((e) => e.proofUrl ?? ''), ...(tab === 'funding' ? funding.map((f) => f.proof_path) : [])]);

  // ---------- Header numbers ----------
  const opening = funding.find((f) => f.note === 'Opening budget');
  const fundedExtra = funding.filter((f) => f !== opening).reduce((a, f) => a + Number(f.amount), 0);
  const movedNet = changes.filter((c) => c.status === 'applied' && c.kind !== 'opening' && c.kind !== 'fund').reduce((a, c) => a + (c.target_project_id === id ? Number(c.amount) : Number(c.budget_after) - Number(c.budget_before)), 0);
  const budgetNote = [opening ? `${whole(opening.amount / 1000)}k opening` : null, fundedExtra ? `+${whole(fundedExtra / 1000)}k funded` : null, movedNet ? `${movedNet > 0 ? '+' : '−'}${whole(Math.abs(movedNet) / 1000)}k changes` : null].filter(Boolean).join(' · ');
  const pendingCount = expenses.filter((e) => e.status === 'pending' || e.status === 'info_requested').length;
  const stats = [
    { label: 'Budget', value: whole(project.budget), note: budgetNote || '—', red: false },
    { label: 'Spent & approved', value: whole(project.spent), note: `${project.pct}% of budget`, red: false },
    { label: 'Held for pending', value: whole(project.held), note: `${pendingCount} claim${pendingCount === 1 ? '' : 's'}`, red: project.held > 0 },
    { label: 'Left to spend', value: whole(project.left), note: `${whole(project.available)} after pending`, red: false },
    { label: 'Runway', value: project.runway === null ? '—' : `≈ ${project.runway} days`, note: project.daily_burn > 0 ? `at ${cur} ${whole(project.daily_burn)} / day (14-day avg)` : 'No approved spend in 14 days', red: project.low }
  ];

  // ---------- Team usage this month ----------
  const usage = new Map<string, number>();
  for (const e of expenses) {
    if (e.status !== 'rejected' && e.paid_at >= monthStart) usage.set(e.submitted_by, (usage.get(e.submitted_by) ?? 0) + Number(e.approved_amount ?? e.amount));
  }

  const rules = [
    { k: 'Receipt required above', v: `${cur} ${whole(rule(project, company, 'receipt_required_above'))}` },
    { k: 'Auto-approve with receipt, up to', v: `${cur} ${whole(rule(project, company, 'auto_approve_up_to'))}` },
    { k: 'Admin approval above', v: `${cur} ${whole(rule(project, company, 'admin_approval_above'))}` },
    { k: 'Default monthly limit per worker', v: whole(company.default_monthly_limit) },
    { k: 'Alert me when left falls below', v: `${rule(project, company, 'alert_below_pct')}%` }
  ];

  const tabHref = (t: Tab) => `/projects/${id}?tab=${t}`;
  const filterHref = (f: Filter) => `/projects/${id}?tab=ledger&filter=${f}`;
  const typeTag = (t: Entry['type']) => <span className={`tag w44 ${t === 'HELD' ? 'red' : ''}`} style={t === 'OUT' ? { color: 'var(--ink-2)' } : undefined}>{t}</span>;
  const changeTag = (k: string) => ({ increase: 'UP', fund: 'UP', opening: 'OPEN', decrease: 'DOWN', move: 'MOVE', set: 'FIX' })[k] ?? k.toUpperCase();

  return (
    <>
      <nav aria-label="Breadcrumb" className="crumbs">
        <Link href="/projects">Projects</Link><span aria-hidden="true">/</span><span className="mono" style={{ color: 'var(--ink)' }}>{project.code}</span>
      </nav>
      <div className="page-head">
        <div style={{ gap: 10 }}>
          <div className="row wrap" style={{ gap: 12 }}>
            <h1 className="h1">{project.name}</h1>
            <span className={`pill lg ${project.low ? 'red' : project.status === 'completed' ? 'grey' : ''}`} style={{ padding: '4px 10px' }}>
              {project.status === 'completed' ? 'Completed' : project.low ? 'Low balance' : 'Healthy'}
            </span>
          </div>
          <span className="muted">
            Lead {project.lead_name ?? '—'} · {members.length} people{project.starts_on ? ` · started ${fullDate(project.starts_on)}` : ''}{project.ends_on ? ` · ends ${fullDate(project.ends_on)}` : ''}
          </span>
        </div>
        {admin ? (
          <div className="row wrap">
            <Link href={`/budget/change?project=${id}`} className="btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>
              Change budget
            </Link>
            <Link href={`/funds/new?project=${id}`} className="btn dark"><PlusChip />Add funds</Link>
            <ProjectMenu id={id} status={project.status} />
          </div>
        ) : null}
      </div>

      <section aria-label="Budget summary" className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(170px, 100%), 1fr))' }}>
        {stats.map((s, i) => (
          <div key={s.label} className="col" style={{ padding: '18px 20px', gap: 6, borderLeft: i ? '1px solid var(--line-2)' : undefined }}>
            <span className="small muted">{s.label}</span>
            <span className="big" style={{ fontSize: 28, letterSpacing: '-0.03em', color: s.red ? 'var(--signal-dark)' : 'var(--ink)' }}>{s.value}</span>
            <span className="small muted">{s.note}</span>
          </div>
        ))}
      </section>

      <div className="split" style={{ gap: 22 }}>
        <section aria-label="Project sections" className="card clip wide" style={{ flexBasis: 600 }}>
          <div role="tablist" aria-label="Project sections" className="tabs">
            <Link role="tab" href={tabHref('ledger')} aria-selected={tab === 'ledger'}>Ledger</Link>
            <Link role="tab" href={tabHref('expenses')} aria-selected={tab === 'expenses'}>Expenses <span className="mono small">{expenses.length}</span></Link>
            {admin ? <Link role="tab" href={tabHref('funding')} aria-selected={tab === 'funding'}>Funding <span className="mono small">{funding.length}</span></Link> : null}
            {admin ? <Link role="tab" href={tabHref('changes')} aria-selected={tab === 'changes'}>Budget changes <span className="mono small">{changes.filter((c) => c.kind !== 'opening' && c.kind !== 'fund').length}</span></Link> : null}
            <Link role="tab" href={tabHref('rules')} aria-selected={tab === 'rules'}>Rules</Link>
          </div>

          {tab === 'ledger' ? (
            <>
              <div className="row wrap between" style={{ padding: '14px 16px' }}>
                <div role="group" aria-label="Filter entries" className="seg">
                  {(['all', 'in', 'out', 'held'] as Filter[]).map((f) => (
                    <Link key={f} href={filterHref(f)} aria-current={filter === f}>{{ all: 'All', in: 'Money in', out: 'Money out', held: 'Held' }[f]}</Link>
                  ))}
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <span className="btn md" style={{ cursor: 'default', borderColor: 'var(--line)', fontWeight: 400 }}><Icon name="calendar" size={15} />{project.starts_on ? dayMonth(project.starts_on) : dayMonth(project.created_at, tz)} – {dayMonth(new Date(), tz)}</span>
                  <a href={`/api/export/ledger?project=${id}`} className="btn md" style={{ borderColor: 'var(--line)', fontWeight: 400 }}>Export · CSV</a>
                </div>
              </div>
              <div className="tbl">
                <div className="tbl-inner" style={{ ['--minw' as string]: '860px', ['--cols' as string]: '72px minmax(220px, 2.6fr) 80px 76px 92px 92px 104px' }}>
                  <div className="tr th" style={{ padding: '10px 16px' }}><span>When</span><span>Entry</span><span>By</span><span>Proof</span><span className="right">In</span><span className="right">Out</span><span className="right">Balance</span></div>
                  {shown.map((l, i) => (
                    <div key={i} className={`tr ${l.held ? 'held' : ''}`} style={{ padding: '13px 16px', alignItems: 'start' }}>
                      <span className="col mono small" style={{ gap: 2 }}><span>{dayMonth(l.at, tz)}</span><span className="muted">{time(l.at, tz)}</span></span>
                      <span className="row" style={{ gap: 10, alignItems: 'flex-start', minWidth: 0 }}>
                        {typeTag(l.type)}
                        <span className="col" style={{ gap: 4, minWidth: 0 }}>
                          {l.href ? <Link href={l.href} style={{ fontWeight: 600, textDecoration: 'none' }}>{l.title}</Link> : <span style={{ fontWeight: 600 }}>{l.title}</span>}
                          <span className="small muted" style={{ lineHeight: 1.4 }}>{l.sub}</span>
                        </span>
                      </span>
                      <span className="s13 ink2">{l.by}</span>
                      <span className="row small ink2" style={{ gap: 6 }}>
                        <Icon name="file" size={14} />
                        {l.proofUrl && urls.get(l.proofUrl) ? <a href={urls.get(l.proofUrl)} target="_blank" rel="noreferrer" className="ink2">{l.proof}</a> : l.proof}
                      </span>
                      <span className="mono right" style={{ fontWeight: 600 }}>{l.inAmt ? money(l.inAmt) : ''}</span>
                      <span className={`mono right ${l.held ? 'red' : ''}`} style={{ fontWeight: 600, fontStyle: l.held ? 'italic' : undefined }}>{l.outAmt ? money(l.outAmt) : ''}</span>
                      <span className="mono right ink2">{l.bal === undefined ? '—' : money(l.bal)}</span>
                    </div>
                  ))}
                  {!shown.length ? <div className="empty">No entries yet.</div> : null}
                  {filtered.length > shown.length ? (
                    <div className="row between s13 muted" style={{ padding: '14px 16px' }}>
                      <span>{filtered.length - shown.length} earlier entries{opening ? ` · opening budget ${cur} ${money(opening.amount)} on ${dayMonth(opening.created_at, tz)}` : ''}</span>
                      <Link href={`/projects/${id}?tab=ledger&filter=${filter}&more=${limit + 50}`} className="btn md" style={{ borderColor: 'var(--line)' }}>Load more</Link>
                    </div>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}

          {tab === 'expenses' ? (
            <div className="tbl">
              <div className="tbl-inner" style={{ ['--minw' as string]: '760px', ['--cols' as string]: '90px 2fr 1.2fr 1fr 1fr 110px' }}>
                <div className="tr th"><span>Claim</span><span>Expense</span><span>Worker</span><span>Paid on</span><span className="right">{cur}</span><span>Status</span></div>
                {expenses.map((e) => (
                  <div key={e.id} className="tr">
                    <Link href={`/approvals?id=${e.id}`} className="mono small" style={{ textDecoration: 'none' }}>{e.ref}</Link>
                    <span className="col" style={{ gap: 2, minWidth: 0 }}><span style={{ fontWeight: 600 }}>{e.title}</span><span className="small muted">{PAY_METHOD_LABEL[e.pay_method]}</span></span>
                    <span className="s13">{e.submitter?.full_name}</span>
                    <span className="mono small muted">{dayMonth(e.paid_at, tz)} {time(e.paid_at, tz)}</span>
                    <span className="mono right" style={{ fontWeight: 600 }}>{money(e.amount)}</span>
                    <span className={`pill ${['pending', 'rejected'].includes(e.status) ? 'red' : ''}`}>{STATUS_LABEL[e.status]}</span>
                  </div>
                ))}
                {!expenses.length ? <div className="empty">No claims on this project yet.</div> : null}
              </div>
            </div>
          ) : null}

          {tab === 'funding' && admin ? (
            <div className="tbl">
              <div className="tbl-inner" style={{ ['--minw' as string]: '700px', ['--cols' as string]: '96px 1.6fr 1fr 1.4fr 110px' }}>
                <div className="tr th"><span>Received</span><span>Method</span><span>By</span><span>Proof</span><span className="right">{cur}</span></div>
                {funding.map((f) => (
                  <div key={f.id} className="tr">
                    <span className="mono small">{dayMonth(f.received_on)}</span>
                    <span className="col" style={{ gap: 2 }}><span style={{ fontWeight: 600 }}>{FUND_METHOD_LABEL[f.method]}{f.reference ? ` · ${f.reference}` : ''}</span><span className="small muted">{f.ref}{f.note ? ` · ${f.note}` : ''}</span></span>
                    <span className="s13">{f.creator?.full_name}</span>
                    <span className="s13">{urls.get(f.proof_path) ? <a href={urls.get(f.proof_path)} target="_blank" rel="noreferrer">{f.proof_name ?? 'View proof'}</a> : f.proof_name}</span>
                    <span className="mono right" style={{ fontWeight: 600 }}>+{money(f.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'changes' && admin ? (
            <div className="tbl">
              <div className="tbl-inner" style={{ ['--minw' as string]: '760px', ['--cols' as string]: '90px 2fr 1fr 1fr 1.2fr' }}>
                <div className="tr th"><span>When</span><span>Change</span><span>By</span><span>Signed off</span><span className="right">Budget</span></div>
                {changes.filter((c) => c.kind !== 'opening' && c.kind !== 'fund').map((c) => (
                  <div key={c.id} className="tr">
                    <span className="mono small">{dayMonth(c.created_at, tz)}</span>
                    <span className="row" style={{ gap: 10, minWidth: 0 }}>
                      <span className={`tag ${c.kind === 'decrease' ? 'red' : ''}`}>{changeTag(c.kind)}</span>
                      <span className="s13 ink2">{c.reason}{c.reference ? ` · ${c.reference}` : ''}{c.status === 'pending' ? ' · waiting' : c.status === 'declined' ? ' · declined' : ''}</span>
                    </span>
                    <span className="s13">{shortName(c.requester?.full_name)}</span>
                    <span className="s13 muted">{c.status === 'pending' ? 'Pending' : c.signer ? shortName(c.signer.full_name) : 'Not needed'}</span>
                    <span className="mono right">{c.kind === 'move' ? `${c.target_project_id === id ? '+' : '−'}${whole(c.amount)}` : `${whole(c.budget_before)} → ${whole(c.budget_after)}`}</span>
                  </div>
                ))}
                {!changes.filter((c) => c.kind !== 'opening' && c.kind !== 'fund').length ? <div className="empty">No budget changes yet.</div> : null}
              </div>
            </div>
          ) : null}

          {tab === 'rules' ? (
            <div style={{ padding: 20 }}>
              {admin ? (
                <RulesForm
                  projectId={id}
                  currency={cur}
                  values={{
                    receipt_required_above: project.receipt_required_above,
                    auto_approve_up_to: project.auto_approve_up_to,
                    admin_approval_above: project.admin_approval_above,
                    alert_below_pct: project.alert_below_pct,
                    workers_see_balance: project.workers_see_balance ?? company.workers_see_balance
                  }}
                  defaults={{
                    receipt_required_above: company.receipt_required_above,
                    auto_approve_up_to: company.auto_approve_up_to,
                    admin_approval_above: company.admin_approval_above,
                    alert_below_pct: company.alert_below_pct
                  }}
                />
              ) : (
                <div className="col">{rules.map((r) => <div key={r.k} className="kv"><span className="muted">{r.k}</span><span className="mono">{r.v}</span></div>)}</div>
              )}
            </div>
          ) : null}
        </section>

        <div className="narrow">
          <section aria-labelledby="teamHead" className="card pad col" style={{ gap: 4 }}>
            <div className="row between" style={{ alignItems: 'baseline', marginBottom: 6 }}>
              <h2 id="teamHead" className="h2" style={{ fontSize: 19 }}>Who can spend</h2>
              {admin ? <Link href="/team" className="s13" style={{ fontWeight: 600 }}>Manage</Link> : null}
            </div>
            <span className="small muted" style={{ marginBottom: 6 }}>This month, against each person’s limit</span>
            {members.map((m) => {
              const used = usage.get(m.user_id) ?? 0;
              const lim = Number(m.monthly_limit);
              const pct = lim > 0 ? Math.min(100, Math.round((used / lim) * 100)) : 0;
              const isLead = project.lead_id === m.user_id;
              return (
                <div key={m.user_id} className="col" style={{ gap: 8, padding: '12px 0', borderTop: '1px solid var(--line-3)' }}>
                  <div className="row">
                    <span className="av grey s30">{initials(m.member?.full_name)}</span>
                    <span className="col grow">
                      <span style={{ fontWeight: 600 }}>{m.member?.full_name}</span>
                      <span className="small muted">{isLead ? 'Project lead' : m.member?.role === 'worker' ? 'Worker' : m.member?.role === 'approver' ? 'Approver' : 'Admin'}</span>
                    </span>
                    {pct >= 100 ? <span className="pill red">Limit reached</span> : !m.member?.last_seen_at ? <span className="pill grey">Invited</span> : null}
                    {admin ? <MemberLimit projectId={id} userId={m.user_id} name={m.member?.full_name ?? ''} limit={lim} /> : null}
                  </div>
                  <div className="row">
                    <div className="thin"><div className={pct >= 100 ? 'red' : ''} style={{ width: `${pct}%` }} /></div>
                    <span className="mono small ink2 nowrap">{whole(used)} / {whole(lim)}</span>
                  </div>
                </div>
              );
            })}
            {!members.length ? <span className="s13 muted list-row">Nobody can spend on this project yet.</span> : null}
            {admin ? <AddMemberForm projectId={id} people={((peopleRes.data ?? []) as { id: string; full_name: string }[]).filter((p) => !members.some((m) => m.user_id === p.id))} defaultLimit={company.default_monthly_limit} /> : null}
          </section>
          <section aria-labelledby="rulesHead" className="card pad col" style={{ gap: 4 }}>
            <div className="row between" style={{ alignItems: 'baseline', marginBottom: 8 }}>
              <h2 id="rulesHead" className="h2" style={{ fontSize: 19 }}>Spending rules</h2>
              {admin ? <Link href={tabHref('rules')} className="s13 red" style={{ fontWeight: 600 }}>Edit</Link> : null}
            </div>
            {rules.map((r) => <div key={r.k} className="kv"><span className="muted">{r.k}</span><span className="mono right">{r.v}</span></div>)}
            <span className="small muted" style={{ marginTop: 6, lineHeight: 1.45 }}>Workers see these limits in the app but can’t change them. Runway: {runwayText(project)}.</span>
          </section>
        </div>
      </div>
    </>
  );
}
