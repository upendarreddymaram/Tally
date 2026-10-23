import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon, PlusChip, type IconName } from '@/components/Icon';
import { ApproveCleanButton, QuickApprove } from '@/components/ui/ActionButtons';
import { requireApprover, isAdminRole } from '@/lib/session';
import { getProjects, rule } from '@/lib/queries';
import { dayMonth, firstName, greeting, initials, money, time, todayLine, when, whole, age } from '@/lib/format';

export const metadata: Metadata = { title: 'Overview' };

type QueueRow = {
  id: string; ref: string; title: string; amount: number; created_at: string; flags: string[]; project_id: string;
  submitter: { full_name: string } | null; project: { name: string } | null; expense_files: { count: number }[];
};

export default async function OverviewPage() {
  const { supabase, profile, company } = await requireApprover();
  const admin = isAdminRole(profile.role);
  const tz = company.timezone;
  const cur = company.currency;

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const [projects, queueRes, pendingAll, fundingRes, changesRes, noReceiptRes, statsUpdated] = await Promise.all([
    getProjects(supabase, company),
    supabase
      .from('expenses')
      .select('id, ref, title, amount, created_at, flags, project_id, submitter:profiles!expenses_submitted_by_fkey(full_name), project:projects(name), expense_files(count)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('expenses').select('amount, flags, created_at, expense_files(count)').in('status', ['pending', 'info_requested']),
    admin
      ? supabase.from('funding').select('amount, proof_name, created_at, project:projects(id, name)').order('created_at', { ascending: false }).limit(3)
      : Promise.resolve({ data: [] }),
    admin
      ? supabase
          .from('budget_changes')
          .select('id, kind, amount, budget_before, budget_after, note, reason, requester:profiles!budget_changes_requested_by_fkey(full_name), project:projects!budget_changes_project_id_fkey(name)')
          .eq('status', 'pending')
          .neq('requested_by', profile.id)
          .limit(2)
      : Promise.resolve({ data: [] }),
    supabase
      .from('expenses')
      .select('amount, submitted_by, submitter:profiles!expenses_submitted_by_fkey(full_name), project:projects(name)')
      .contains('flags', ['No receipt'])
      .gte('created_at', weekAgo),
    Promise.resolve(new Date())
  ]);

  const active = projects.filter((p) => p.status === 'active');
  const funded = active.reduce((a, p) => a + p.budget, 0);
  const spent = active.reduce((a, p) => a + p.spent, 0);
  const held = active.reduce((a, p) => a + p.held, 0);
  const available = funded - spent - held;
  const approvedCount = active.reduce((a, p) => a + p.approved_count, 0);
  const pct = (v: number) => (funded > 0 ? (v / funded) * 100 : 0);

  const pending = (pendingAll.data ?? []) as { amount: number; flags: string[]; created_at: string; expense_files: { count: number }[] }[];
  const oldest = pending.reduce<string | null>((o, e) => (!o || e.created_at < o ? e.created_at : o), null);
  const clean = pending.filter((e) => !e.flags?.length && (e.expense_files?.[0]?.count ?? 0) > 0);
  const cleanSum = clean.reduce((a, e) => a + Number(e.amount), 0);

  const lastFund = (fundingRes.data ?? [])[0] as { amount: number; created_at: string } | undefined;

  const sorted = [...active].sort((a, b) => (a.runway ?? 1e9) - (b.runway ?? 1e9)).slice(0, 4);
  const queue = (queueRes.data ?? []) as unknown as QueueRow[];

  // Things that need attention
  type Alert = { title: string; body: string; cta: string; href: string; icon: IconName; red: boolean };
  const alerts: Alert[] = [];
  for (const p of active.filter((x) => x.low).slice(0, 2)) {
    alerts.push({
      title: p.runway !== null ? `${p.name} has about ${p.runway} days of budget left` : `${p.name} is below ${rule(p, company, 'alert_below_pct')}% of budget`,
      body: `${p.daily_burn > 0 ? `At ${cur} ${whole(p.daily_burn)} a day. ` : ''}${cur} ${whole(p.held)} more is held for pending claims.`,
      cta: 'Add funds', href: `/funds/new?project=${p.id}`, icon: 'warn', red: true
    });
  }
  for (const c of (changesRes.data ?? []) as unknown as { kind: string; amount: number; note: string; reason: string; requester: { full_name: string } | null; project: { name: string } | null }[]) {
    alerts.push({
      title: `${firstName(c.requester?.full_name)} asked to ${c.kind === 'move' ? 'move' : 'reduce'} ${c.project?.name} by ${cur} ${whole(c.amount)}`,
      body: `Changes over ${cur} ${whole(company.signoff_above)} need a second admin. Reason: ${c.reason ?? '—'} — ${c.note ?? ''}`,
      cta: 'Review the change', href: '/budget-changes', icon: 'changes', red: false
    });
  }
  const byWorker = new Map<string, { name: string; n: number; sum: number; project: string }>();
  for (const e of (noReceiptRes.data ?? []) as unknown as { amount: number; submitted_by: string; submitter: { full_name: string } | null; project: { name: string } | null }[]) {
    const w = byWorker.get(e.submitted_by) ?? { name: e.submitter?.full_name ?? '', n: 0, sum: 0, project: e.project?.name ?? '' };
    w.n += 1;
    w.sum += Number(e.amount);
    byWorker.set(e.submitted_by, w);
  }
  for (const [, w] of [...byWorker].filter(([, w]) => w.n >= 2).slice(0, 1)) {
    alerts.push({
      title: `${firstName(w.name)} has ${w.n} claims without receipts this week`,
      body: `${cur} ${whole(w.sum)} in total. Receipts are required above ${cur} ${whole(company.receipt_required_above)}.`,
      cta: 'Open the claims', href: '/approvals?filter=noreceipt', icon: 'noReceipt', red: true
    });
  }

  const cash = [
    { label: 'Funded', value: whole(funded), note: lastFund ? `+${whole(lastFund.amount)} on ${dayMonth(lastFund.created_at, tz)} (proof on file)` : 'Total budget of active projects', swatch: 'var(--field)', red: false },
    { label: 'Spent & approved', value: whole(spent), note: `${Math.round(pct(spent))}% · ${approvedCount} expenses`, swatch: 'var(--ink-2)', red: false },
    { label: 'Held for pending', value: whole(held), note: `${pending.length} claims${oldest ? ` · oldest ${age(oldest)}` : ''}`, swatch: 'var(--held)', red: true },
    { label: 'Available to spend', value: whole(available), note: 'Funded − spent − held', swatch: 'var(--signal)', red: true }
  ];
  const step = funded > 0 ? funded / 4 : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">{todayLine(tz)}</span>
          <h1 className="h1">{greeting(tz)}, {firstName(profile.full_name)}</h1>
        </div>
        <div className="row wrap">
          <form action="/expenses" className="row">
            <label htmlFor="search" className="sr-only">Search</label>
            <input id="search" name="q" type="search" placeholder="Search claims, receipts, people" className="input" style={{ height: 44, width: 260 }} />
          </form>
          {admin ? (
            <>
              <Link href="/budget/change" className="btn">Change a budget</Link>
              <Link href="/funds/new" className="btn dark"><PlusChip />Add funds</Link>
            </>
          ) : null}
        </div>
      </div>

      <section aria-labelledby="cashHead" className="card" style={{ borderRadius: 18, padding: '26px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>
        <div className="row wrap between">
          <h2 id="cashHead" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>Cash position · {active.length} active project{active.length === 1 ? '' : 's'}</h2>
          <span className="mono small muted">Updated {time(statsUpdated, tz)} · {cur}</span>
        </div>
        <div className="grid-auto" style={{ ['--min' as string]: '200px', gap: 20 }}>
          {cash.map((c) => (
            <div key={c.label} className="col" style={{ gap: 6 }}>
              <span className="row s13 muted" style={{ gap: 8 }}><span className="swatch" style={{ background: c.swatch }} />{c.label}</span>
              <span className="big" style={{ fontSize: 36, color: c.red ? 'var(--signal-dark)' : 'var(--ink)' }}>{c.value}</span>
              <span className="small muted">{c.note}</span>
            </div>
          ))}
        </div>
        <div className="col" style={{ gap: 8 }}>
          <div role="img" aria-label={`${Math.round(pct(spent))}% spent, ${Math.round(pct(held))}% held for pending claims, ${Math.round(pct(available))}% available`} className="stack">
            <div className="spent" style={{ width: `${pct(spent)}%` }} />
            <div className="held" style={{ width: `${pct(held)}%` }} />
            <div className="left" style={{ width: `${Math.max(0, pct(available))}%` }} />
          </div>
          <div className="row between mono muted" style={{ fontSize: 11 }}>
            {[0, 1, 2, 3, 4].map((i) => <span key={i}>{step ? (i * step >= 1000 ? `${Math.round((i * step) / 1000)}k` : whole(i * step)) : 0}</span>)}
          </div>
        </div>
      </section>

      <section aria-labelledby="projHead" className="col" style={{ gap: 14 }}>
        <div className="row wrap between" style={{ alignItems: 'baseline' }}>
          <h2 id="projHead" className="h2 lg">Projects <span className="muted" style={{ fontWeight: 500 }}>sorted by runway</span></h2>
          <Link href="/projects" style={{ fontWeight: 600 }}>All projects</Link>
        </div>
        {sorted.length ? (
          <div className="grid-auto" style={{ ['--min' as string]: '250px' }}>
            {sorted.map((p) => (
              <article key={p.id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="row between"><span className="mono small muted">{p.code}</span><span className={`pill lg ${p.low ? 'red' : ''}`}>{p.low ? 'Low balance' : 'Healthy'}</span></div>
                <Link href={`/projects/${p.id}`} className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, textDecoration: 'none', minHeight: 44 }}>{p.name}</Link>
                <div className="bar"><div className={`fill ${p.low ? 'red' : ''}`} style={{ width: `${Math.min(100, p.pct)}%` }} /><div className="ticks" /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <div className="col" style={{ gap: 3 }}><span className="small muted">Left of {whole(p.budget)}</span><span className="mono" style={{ fontSize: 17, fontWeight: 600 }}>{whole(p.left)}</span></div>
                  <div className="col" style={{ gap: 3 }}><span className="small muted">Runway at current pace</span><span className={`mono ${p.low ? 'red' : ''}`} style={{ fontSize: 17, fontWeight: 600 }}>{p.runway === null ? '—' : `≈ ${p.runway} days`}</span></div>
                </div>
                <div className="row between" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>
                  <span className="row s13 ink2" style={{ gap: 8 }}><span className="av s26">{initials(p.lead_name)}</span>{p.lead_name ?? 'No lead'}</span>
                  <span className="s13 muted">{p.members} people</span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="card empty">
            No active projects yet. {admin ? <Link href="/projects/new" style={{ fontWeight: 600 }}>Set up your first project</Link> : null}
          </div>
        )}
      </section>

      <div className="split">
        <section aria-labelledby="queueHead" className="card clip wide">
          <div className="card-head">
            <div className="col" style={{ gap: 2 }}>
              <h2 id="queueHead" className="h2">Waiting for approval</h2>
              <span className="s13 muted">{pending.length} claims · {cur} {whole(held)} held from budgets</span>
            </div>
            <Link href="/approvals" style={{ fontWeight: 600 }}>Open review</Link>
          </div>
          <div className="tbl">
            <div className="tbl-inner" style={{ ['--minw' as string]: '660px', ['--cols' as string]: '44px 2.2fr 1.2fr 1fr 1fr 100px' }}>
              <div className="tr th"><span>Proof</span><span>Expense</span><span>Project</span><span>Submitted</span><span className="right">{cur}</span><span /></div>
              {queue.map((q) => (
                <div key={q.id} className="tr">
                  <span className={`receipt-thumb ${(q.expense_files?.[0]?.count ?? 0) > 0 ? '' : 'none'}`} />
                  <span className="col" style={{ gap: 4, minWidth: 0 }}>
                    <span style={{ fontWeight: 600 }}>{q.title}</span>
                    <span className="row wrap small muted" style={{ gap: 6 }}>
                      {q.submitter?.full_name}
                      {q.flags?.map((f) => <span key={f} className={`pill ${/receipt|duplicate|budget/i.test(f) ? 'red' : ''}`}>{f}</span>)}
                    </span>
                  </span>
                  <span className="ink2">{q.project?.name}</span>
                  <span className="mono small muted">{when(q.created_at, tz)}</span>
                  <span className="mono right" style={{ fontWeight: 600 }}>{money(q.amount)}</span>
                  <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
                    <QuickApprove id={q.id} label={q.title} />
                    <Link href={`/approvals?id=${q.id}`} aria-label={`Open ${q.title}`} className="icon-btn ghost"><Icon name="chevron" size={16} width={2.2} /></Link>
                  </span>
                </div>
              ))}
              {!queue.length ? <div className="empty">Nothing waiting. New claims show up here.</div> : null}
            </div>
          </div>
          {clean.length ? (
            <div className="card-foot">
              <span><b>{clean.length} claim{clean.length === 1 ? '' : 's'}</b> passed every check (receipt attached, under limits, no duplicates)</span>
              <ApproveCleanButton label={`Approve ${clean.length} clean claim${clean.length === 1 ? '' : 's'} · ${cur} ${money(cleanSum)}`} />
            </div>
          ) : null}
        </section>

        <div className="narrow">
          <section aria-labelledby="attHead" className="card pad col" style={{ gap: 4 }}>
            <h2 id="attHead" className="h2" style={{ marginBottom: 8 }}>Needs your attention</h2>
            {alerts.length ? alerts.slice(0, 3).map((a) => (
              <div key={a.title} className="list-row">
                <span style={{ width: 34, height: 34, flex: 'none', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: a.red ? 'var(--signal-soft)' : 'var(--chip)' }}>
                  <Icon name={a.icon} size={16} width={2.1} stroke={a.red ? '#B3121F' : '#111113'} />
                </span>
                <span className="col" style={{ gap: 4, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, lineHeight: 1.35 }}>{a.title}</span>
                  <span className="s13 muted" style={{ lineHeight: 1.45 }}>{a.body}</span>
                  {admin || !a.href.startsWith('/funds') ? <Link href={a.href} className="s13" style={{ fontWeight: 600, minHeight: 28, display: 'flex', alignItems: 'center' }}>{a.cta}</Link> : null}
                </span>
              </div>
            )) : <span className="s13 muted list-row">All clear. Low balances, sign-offs and missing receipts show up here.</span>}
          </section>
          {admin ? (
            <section aria-labelledby="fundHead" className="card pad col" style={{ gap: 4 }}>
              <div className="row between" style={{ alignItems: 'baseline', marginBottom: 8 }}>
                <h2 id="fundHead" className="h2">Latest funding</h2>
                <Link href="/projects" className="s13" style={{ fontWeight: 600 }}>Ledgers</Link>
              </div>
              {((fundingRes.data ?? []) as unknown as { amount: number; proof_name: string | null; created_at: string; project: { id: string; name: string } | null }[]).map((f, i) => (
                <div key={i} className="list-row between">
                  <span className="col" style={{ gap: 4, minWidth: 0 }}>
                    <Link href={`/projects/${f.project?.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>{f.project?.name}</Link>
                    <span className="small muted">{f.proof_name ?? 'Proof'} · {dayMonth(f.created_at, tz)}</span>
                  </span>
                  <span className="mono nowrap" style={{ fontWeight: 600 }}>+{money(f.amount)}</span>
                </div>
              ))}
              {!(fundingRes.data ?? []).length ? <span className="s13 muted list-row">No funding recorded yet.</span> : null}
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
