import type { Metadata } from 'next';
import { requireApprover } from '@/lib/session';
import { dayMonth, parts, whole } from '@/lib/format';
import { PrintButton } from './PrintButton';

export const metadata: Metadata = { title: 'Reports' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type Row = {
  amount: number; approved_amount: number | null; status: string; created_at: string; decided_at: string | null; paid_at: string; flags: string[];
  submitter: { full_name: string } | null; project: { name: string } | null; category: { name: string } | null; expense_files: { count: number }[];
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string; project?: string }> }) {
  const sp = await searchParams;
  const { supabase, company } = await requireApprover();
  const tz = company.timezone;
  const now = parts(new Date(), tz);
  const [y, m] = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month.split('-').map(Number) : [now.y, now.m + 1];
  const from = new Date(Date.UTC(y!, m! - 1, 1));
  const to = new Date(Date.UTC(y!, m!, 1));
  const isCurrent = y === now.y && m === now.m + 1;
  const lastDay = isCurrent ? now.d : new Date(Date.UTC(y!, m!, 0)).getUTCDate();

  let q = supabase
    .from('expenses')
    .select('amount, approved_amount, status, created_at, decided_at, paid_at, flags, submitter:profiles!expenses_submitted_by_fkey(full_name), project:projects(name), category:categories(name), expense_files(count)')
    .gte('paid_at', from.toISOString())
    .lt('paid_at', to.toISOString());
  if (sp.project) q = q.eq('project_id', sp.project);
  const [{ data }, { data: projects }] = await Promise.all([q, supabase.from('projects').select('id, name').order('name')]);
  const rows = (data ?? []) as unknown as Row[];
  const approved = rows.filter((r) => r.status === 'approved' || r.status === 'part_approved');
  const amt = (r: Row) => Number(r.approved_amount ?? 0);

  const group = (key: (r: Row) => string) => {
    const mp = new Map<string, number>();
    for (const r of approved) mp.set(key(r), (mp.get(key(r)) ?? 0) + amt(r));
    return [...mp].sort((a, b) => b[1] - a[1]);
  };
  const cats = group((r) => r.category?.name ?? 'Uncategorised');
  const projs = group((r) => r.project?.name ?? '—');
  const people = group((r) => r.submitter?.full_name ?? '—').slice(0, 6);

  const daily = Array.from({ length: lastDay }, () => 0);
  for (const r of approved) {
    const d = parts(r.paid_at, tz).d;
    if (d <= lastDay) daily[d - 1]! += amt(r);
  }
  const max = Math.max(1, ...daily);
  const total = daily.reduce((a, b) => a + b, 0);
  const avg = total / Math.max(1, lastDay);
  const peakIdx = daily.indexOf(Math.max(...daily));

  const decided = rows.filter((r) => r.decided_at);
  const within24 = decided.filter((r) => new Date(r.decided_at!).getTime() - new Date(r.created_at).getTime() <= 86400000).length;
  const withProof = rows.filter((r) => (r.expense_files?.[0]?.count ?? 0) > 0).length;
  const noProof = rows.length - withProof;
  const rejectedOrPart = rows.filter((r) => r.status === 'rejected' || r.status === 'part_approved').length;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const quality = [
    { k: 'Claims with a receipt attached', v: pct(withProof, rows.length), warn: false },
    { k: 'Decided within 24 hours', v: pct(within24, decided.length), warn: false },
    { k: 'Submitted without proof', v: `${noProof} claim${noProof === 1 ? '' : 's'}`, warn: noProof > 0 },
    { k: 'Rejected or part-approved', v: rows.length ? `${((rejectedOrPart / rows.length) * 100).toFixed(1)}%` : '—', warn: false }
  ];

  const monthOpts = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(now.y, now.m - i, 1));
    return { v: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`, l: `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });
  const projectName = (projects ?? []).find((p) => p.id === sp.project)?.name;

  const Bars = ({ list, color }: { list: [string, number][]; color: string }) => {
    const mx = Math.max(1, ...list.map((x) => x[1]));
    return (
      <>
        {list.map(([k, v]) => (
          <div key={k} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 90px', gap: 12, alignItems: 'center' }}>
            <span className="s13" style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span>
            <span style={{ display: 'block', height: 14, borderRadius: 4, background: 'var(--chip)', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.round((v / mx) * 100)}%`, background: color }} /></span>
            <span className="mono s13 right">{whole(v)}</span>
          </div>
        ))}
        {!list.length ? <span className="s13 muted">No approved spend in this period.</span> : null}
      </>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Reports</h1>
          <span className="muted">{MONTHS[m! - 1]} {y} · {projectName ?? 'all projects'} · approved spend only</span>
        </div>
        <form action="/reports" className="row wrap no-print">
          <select name="month" aria-label="Month" className="input" style={{ height: 44, width: 'auto' }} defaultValue={`${y}-${String(m).padStart(2, '0')}`}>
            {monthOpts.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
          </select>
          <select name="project" aria-label="Project" className="input" style={{ height: 44, width: 'auto' }} defaultValue={sp.project ?? ''}>
            <option value="">All projects</option>
            {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn">Show</button>
          <PrintButton />
        </form>
      </div>
      <section aria-label="Spend per day" className="card pad-lg col" style={{ gap: 16 }}>
        <div className="row wrap between" style={{ alignItems: 'baseline' }}>
          <h2 className="h2">Spend per day</h2>
          <span className="s13 muted">
            Average <b className="mono">{company.currency} {whole(avg)}</b>
            {total ? <> · peak {dayMonth(new Date(Date.UTC(y!, m! - 1, peakIdx + 1)), 'UTC')} <b className="mono">{company.currency} {whole(daily[peakIdx])}</b></> : null}
          </span>
        </div>
        <div role="img" aria-label={`Daily spend, 1 to ${lastDay} ${MONTHS[m! - 1]}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${lastDay}, minmax(0, 1fr))`, gap: 4, alignItems: 'end', height: 160 }}>
          {daily.map((v, i) => (
            <span key={i} title={`${i + 1} ${MONTHS[m! - 1]}: ${whole(v)}`} style={{ display: 'block', borderRadius: '3px 3px 0 0', height: `${Math.max(2, Math.round((v / max) * 100))}%`, background: v && v === max && v > avg * 3 ? 'var(--signal)' : v ? 'var(--ink-2)' : 'var(--chip)' }} />
          ))}
        </div>
        <div className="row between mono muted" style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {[1, Math.ceil(lastDay / 3), Math.ceil((2 * lastDay) / 3), lastDay].map((d, i) => <span key={i}>{d} {MONTHS[m! - 1]!.slice(0, 3)}</span>)}
        </div>
      </section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 22 }}>
        <section aria-label="By category" className="card pad-lg col" style={{ gap: 14 }}><h2 className="h2">By category</h2><Bars list={cats} color="var(--ink-2)" /></section>
        <section aria-label="By project" className="card pad-lg col" style={{ gap: 14 }}><h2 className="h2">By project</h2><Bars list={projs} color="var(--signal-dark)" /></section>
        <section aria-label="By person" className="card pad-lg col" style={{ gap: 14 }}><h2 className="h2">Top spenders</h2><Bars list={people} color="var(--ink)" /></section>
        <section aria-label="Compliance" className="card pad-lg col" style={{ gap: 14 }}>
          <h2 className="h2">How clean are the claims?</h2>
          {quality.map((q) => (
            <div key={q.k} className="row between" style={{ paddingTop: 12, borderTop: '1px solid var(--line-3)' }}>
              <span className="s13">{q.k}</span><span className={`mono ${q.warn ? 'red' : ''}`} style={{ fontWeight: 600 }}>{q.v}</span>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
