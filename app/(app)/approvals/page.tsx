import Link from 'next/link';
import type { Metadata } from 'next';
import { isAdminRole, requireApprover } from '@/lib/session';
import { getProjects, rule, signedUrls } from '@/lib/queries';
import { age, firstName, fullDate, money, PAY_METHOD_LABEL, STATUS_LABEL, when, whole } from '@/lib/format';
import { DecisionPanel, KeyboardNav } from './DecisionPanel';

export const metadata: Metadata = { title: 'Approvals' };

type Exp = {
  id: string; ref: string; title: string; vendor: string | null; amount: number; approved_amount: number | null; status: string; flags: string[];
  created_at: string; paid_at: string; pay_method: string; card_last4: string | null; note: string | null; project_id: string; submitted_by: string;
  decision_note: string | null; decision_reason: string | null; decided_at: string | null; auto_approved: boolean;
  submitter: { full_name: string } | null; decider: { full_name: string } | null; project: { name: string } | null; category: { name: string } | null;
  expense_files: { path: string; name: string }[];
};

const SELECT =
  'id, ref, title, vendor, amount, approved_amount, status, flags, created_at, paid_at, pay_method, card_last4, note, project_id, submitted_by, decision_note, decision_reason, decided_at, auto_approved, submitter:profiles!expenses_submitted_by_fkey(full_name), decider:profiles!expenses_decided_by_fkey(full_name), project:projects(name), category:categories(name), expense_files(path, name)';

const FILTERS = {
  all: { label: 'All', test: (_e: Exp) => true },
  over: { label: 'Over limit', test: (e: Exp) => e.flags.some((f) => /^Over/.test(f)) },
  noreceipt: { label: 'No receipt', test: (e: Exp) => !e.expense_files.length },
  flagged: { label: 'Flagged', test: (e: Exp) => e.flags.some((f) => /duplicate|budget/i.test(f)) },
  reply: { label: 'Reply needed', test: (e: Exp) => e.status === 'info_requested' },
  clean: { label: 'Clean', test: (e: Exp) => !e.flags.length && e.expense_files.length > 0 && e.status === 'pending' }
} as const;
type F = keyof typeof FILTERS;

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<{ id?: string; filter?: string }> }) {
  const sp = await searchParams;
  const { supabase, company, profile } = await requireApprover();
  const admin = isAdminRole(profile.role);
  const tz = company.timezone;
  const cur = company.currency;
  const filter: F = sp.filter && sp.filter in FILTERS ? (sp.filter as F) : 'all';

  const [{ data }, projects] = await Promise.all([
    supabase.from('expenses').select(SELECT).in('status', ['pending', 'info_requested']).order('created_at', { ascending: true }),
    getProjects(supabase, company)
  ]);
  const all = (data ?? []) as unknown as Exp[];
  const items = all.filter(FILTERS[filter].test);
  const heldTotal = all.reduce((a, e) => a + Number(e.amount), 0);

  let sel: Exp | undefined = items.find((e) => e.id === sp.id) ?? all.find((e) => e.id === sp.id);
  if (!sel && sp.id) {
    const { data: one } = await supabase.from('expenses').select(SELECT).eq('id', sp.id).maybeSingle();
    sel = (one as unknown as Exp) ?? undefined;
  }
  sel ??= items[0];

  const project = sel ? projects.find((p) => p.id === sel!.project_id) : undefined;
  const urls = sel ? await signedUrls(supabase, sel.expense_files.map((f) => f.path)) : new Map<string, string>();

  // Similar claims for the duplicate check
  let similar: { ref: string; paid_at: string; id: string } | null = null;
  if (sel?.flags.includes('Possible duplicate')) {
    const { data: dup } = await supabase
      .from('expenses')
      .select('id, ref, paid_at')
      .eq('amount', sel.amount)
      .neq('id', sel.id)
      .neq('status', 'rejected')
      .order('paid_at', { ascending: false })
      .limit(1);
    similar = dup?.[0] ?? null;
  }

  const receiptAbove = rule(project, company, 'receipt_required_above');
  const adminAbove = rule(project, company, 'admin_approval_above');
  type Check = { ok: boolean | null; t: string; d: string };
  const checks: Check[] = sel
    ? [
        sel.expense_files.length
          ? { ok: true, t: 'Proof attached.', d: `${sel.expense_files.length} file${sel.expense_files.length > 1 ? 's' : ''}. Compare the total with the claim.` }
          : Number(sel.amount) > receiptAbove
            ? { ok: false, t: 'No receipt.', d: `Required above ${cur} ${whole(receiptAbove)} on this project.` }
            : { ok: true, t: 'No receipt needed.', d: `Under ${cur} ${whole(receiptAbove)}.` },
        sel.flags.includes('Possible duplicate')
          ? { ok: null, t: similar ? `Looks like ${similar.ref}.` : 'Possible duplicate.', d: similar ? `Same amount on ${fullDate(similar.paid_at, tz)}.` : 'Same amount and supplier in the last 30 days.' }
          : { ok: true, t: 'No duplicate.', d: 'Nothing similar in the last 30 days.' },
        Number(sel.amount) > adminAbove ? { ok: null, t: `Over ${cur} ${whole(adminAbove)}.`, d: 'Needs an admin on this project.' } : { ok: true, t: `Under ${cur} ${whole(adminAbove)}.`, d: '' },
        ...(sel.flags.includes('Over monthly limit') ? [{ ok: null, t: 'Over monthly limit.', d: `${firstName(sel.submitter?.full_name)} has gone past their limit on this project.` }] : []),
        ...(sel.flags.includes('Over budget') ? [{ ok: false, t: 'More than the project has left.', d: 'Add funds or part-approve.' }] : [])
      ]
    : [];

  const decided = sel && !['pending', 'info_requested'].includes(sel.status);
  const filterHref = (f: F) => `/approvals?filter=${f}`;
  const idx = sel ? items.findIndex((e) => e.id === sel!.id) : -1;
  const nextId = idx >= 0 ? items[idx + 1]?.id ?? items[idx - 1]?.id : items[0]?.id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Approvals</h1>
          <span className="muted">{all.length} waiting · {cur} {whole(heldTotal)} held · {admin ? 'you can approve any amount' : `you can approve up to ${cur} ${whole(company.admin_approval_above)} (project rules may differ)`}</span>
        </div>
        <div role="group" aria-label="Filter claims" className="row wrap" style={{ gap: 6 }}>
          {(Object.keys(FILTERS) as F[]).map((f) => (
            <Link key={f} href={filterHref(f)} aria-pressed={filter === f} className="chip">{FILTERS[f].label} {all.filter(FILTERS[f].test).length}</Link>
          ))}
        </div>
      </div>

      <KeyboardNav ids={items.map((e) => e.id)} current={sel?.id} filter={filter} />

      <div className="split">
        <section aria-label="Claims" className="card clip" style={{ flex: '1 1 320px', minWidth: 0 }}>
          {items.map((it) => {
            const on = it.id === sel?.id;
            return (
              <Link
                key={it.id}
                href={`/approvals?filter=${filter}&id=${it.id}`}
                aria-current={on}
                className="col"
                style={{ alignItems: 'flex-start', gap: 6, width: '100%', padding: '14px 16px', borderBottom: '1px solid var(--line-3)', textDecoration: 'none', color: 'var(--ink)', background: on ? '#fff' : 'transparent', outline: on ? '2px solid var(--ink)' : undefined, outlineOffset: -2 }}
              >
                <span className="row between" style={{ width: '100%' }}><span style={{ fontWeight: 600 }}>{it.title}</span><span className="mono" style={{ fontWeight: 600 }}>{money(it.amount)}</span></span>
                <span className="row between small muted" style={{ width: '100%' }}><span>{it.submitter?.full_name} · {it.project?.name}</span><span className="mono">{age(it.created_at)}</span></span>
                <span className="row wrap" style={{ gap: 4 }}>
                  {it.status === 'info_requested' ? <span className="pill grey">Reply needed</span> : null}
                  {!it.expense_files.length && !it.flags.includes('No receipt') ? <span className="pill grey">No proof</span> : null}
                  {it.flags.map((f) => <span key={f} className={`pill ${/receipt|duplicate|budget/i.test(f) ? 'red' : ''}`}>{f}</span>)}
                </span>
              </Link>
            );
          })}
          {!items.length ? <div className="empty">{all.length ? 'Nothing matches this filter.' : 'All caught up. Nothing is waiting for approval.'}</div> : null}
          {items.length ? <div className="s13 muted" style={{ padding: '14px 16px' }}>Keyboard: J / K to move, A to approve</div> : null}
        </section>

        {sel ? (
          <div className="col" style={{ flex: '999 1 640px', minWidth: 0, gap: 16 }}>
            <section aria-label="Claim" className="card clip row wrap" style={{ alignItems: 'stretch', gap: 0 }}>
              <div className="proof-pane">
                <div className="row between"><span className="s13" style={{ fontWeight: 600 }}>Proof of payment</span></div>
                {sel.expense_files.length ? (
                  <div className="col" style={{ gap: 12, flex: '1 1 auto', minHeight: 360, justifyContent: 'center' }}>
                    {sel.expense_files.map((f) => {
                      const url = urls.get(f.path);
                      const isImg = /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name);
                      return (
                        <div key={f.path} className="col" style={{ gap: 6 }}>
                          {url && isImg ? (
                            <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Receipt ${f.name}`} className="proof-img" /></a>
                          ) : (
                            <a href={url} target="_blank" rel="noreferrer" className="file-card" style={{ textDecoration: 'none', background: '#fff' }}>
                              <span className="doc-thumb"><span /><span /><span /><span /></span>
                              <span style={{ fontWeight: 600 }}>Open {f.name}</span>
                            </a>
                          )}
                          <span className="mono muted" style={{ fontSize: 11 }}>{f.name}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="col" style={{ flex: '1 1 auto', minHeight: 360, border: '2px dashed var(--field)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20, textAlign: 'center' }}>
                    <span style={{ fontWeight: 600 }}>No proof attached</span>
                    <span className="s13 muted" style={{ lineHeight: 1.45 }}>
                      {Number(sel.amount) > receiptAbove ? `This project needs a receipt above ${cur} ${whole(receiptAbove)}. Ask for it, or reject.` : `Under ${cur} ${whole(receiptAbove)}, so a receipt is optional.`}
                    </span>
                  </div>
                )}
              </div>
              <div className="col" style={{ flex: '999 1 340px', minWidth: 0, padding: 22, gap: 18 }}>
                <div className="col" style={{ gap: 6 }}>
                  <span className="mono small muted">{sel.ref} · {sel.category?.name ?? 'Uncategorised'}{decided ? ` · ${STATUS_LABEL[sel.status]}` : ''}</span>
                  <h2 className="h2" style={{ fontSize: 26, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{sel.title}</h2>
                </div>
                <div style={{ border: '1px solid var(--line-2)', borderRadius: 10, overflow: 'hidden' }}>
                  {[
                    ['Amount', `${cur} ${money(sel.amount)}`],
                    ['Paid on', when(sel.paid_at, tz)],
                    ['Supplier', sel.vendor ?? '—'],
                    ['Paid with', `${PAY_METHOD_LABEL[sel.pay_method]}${sel.card_last4 ? ` •• ${sel.card_last4}` : ''}`]
                  ].map(([k, v], i) => (
                    <div key={k} className="row between s13" style={{ padding: '10px 12px', borderTop: i ? '1px solid var(--line-3)' : undefined }}>
                      <span className="muted">{k}</span><span className="mono">{v}</span>
                    </div>
                  ))}
                </div>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 18px', fontSize: 13 }}>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Submitted by</dt><dd style={{ margin: 0, fontWeight: 600 }}>{sel.submitter?.full_name}</dd></div>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Project</dt><dd style={{ margin: 0, fontWeight: 600 }}><Link href={`/projects/${sel.project_id}`}>{sel.project?.name}</Link></dd></div>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Submitted</dt><dd style={{ margin: 0, fontWeight: 600 }}>{when(sel.created_at, tz)}</dd></div>
                  <div className="col" style={{ gap: 3 }}>
                    <dt className="muted">{decided ? 'Decision' : 'Budget after approval'}</dt>
                    <dd className="mono" style={{ margin: 0, fontWeight: 600 }}>
                      {decided
                        ? `${STATUS_LABEL[sel.status]}${sel.approved_amount != null && sel.status !== 'rejected' ? ' ' + money(sel.approved_amount) : ''}`
                        : project ? `${whole(project.left)} → ${whole(project.left - Number(sel.amount))}` : '—'}
                    </dd>
                  </div>
                </dl>
                {sel.note ? <div style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}><b>Note from {firstName(sel.submitter?.full_name)}: </b>{sel.note}</div> : null}
                {sel.decision_note && (sel.status === 'info_requested' || decided) ? (
                  <div style={{ background: 'var(--chip)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}>
                    <b>{sel.status === 'info_requested' ? 'You asked' : `${sel.decider?.full_name ?? (sel.auto_approved ? 'Tally' : 'Approver')} wrote`}: </b>{sel.decision_reason ? `${sel.decision_reason} — ` : ''}{sel.decision_note}
                  </div>
                ) : null}
                {!decided ? (
                  <div className="col" style={{ gap: 8 }}>
                    {checks.map((k) => (
                      <div key={k.t} className="row s13" style={{ gap: 10, alignItems: 'flex-start' }}>
                        <span className="av dark" style={{ width: 20, height: 20, fontSize: k.ok ? 11 : 12, background: k.ok ? 'var(--ink)' : 'var(--signal-dark)' }}>{k.ok ? '✓' : k.ok === false ? '×' : '!'}</span>
                        <span style={{ lineHeight: 1.45 }}><b style={{ fontWeight: 600 }}>{k.t}</b> <span className="muted">{k.d}</span></span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>
            {!decided ? (
              <DecisionPanel
                key={sel.id}
                id={sel.id}
                amount={Number(sel.amount)}
                first={firstName(sel.submitter?.full_name)}
                currency={cur}
                next={nextId && nextId !== sel.id ? `/approvals?filter=${filter}&id=${nextId}` : `/approvals?filter=${filter}`}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
