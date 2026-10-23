import Link from 'next/link';
import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { getProjects } from '@/lib/queries';
import { firstName, initials, shortName, whole, dayMonth, when } from '@/lib/format';
import { SignOffForm } from './SignOffForm';

export const metadata: Metadata = { title: 'Budget changes' };

type Chg = {
  id: string; kind: string; amount: number; budget_before: number; budget_after: number; project_id: string; target_project_id: string | null;
  reason: string | null; reference: string | null; note: string | null; status: string; created_at: string; requested_by: string; decline_note: string | null;
  requester: { full_name: string } | null; signer: { full_name: string } | null; project: { name: string } | null; target: { name: string } | null;
};

const TAG: Record<string, { t: string; red?: boolean }> = { increase: { t: 'UP' }, fund: { t: 'UP' }, opening: { t: 'OPEN' }, decrease: { t: 'DOWN', red: true }, move: { t: 'MOVE' }, set: { t: 'FIX' } };

export default async function BudgetChangesPage({ searchParams }: { searchParams: Promise<{ project?: string; days?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile, company } = await requireAdmin();
  const tz = company.timezone;
  const cur = company.currency;
  const days = sp.days === 'all' ? null : parseInt(sp.days ?? '90', 10) || 90;

  let q = supabase
    .from('budget_changes')
    .select('id, kind, amount, budget_before, budget_after, project_id, target_project_id, reason, reference, note, status, created_at, requested_by, decline_note, requester:profiles!budget_changes_requested_by_fkey(full_name), signer:profiles!budget_changes_signed_off_by_fkey(full_name), project:projects!budget_changes_project_id_fkey(name), target:projects!budget_changes_target_project_id_fkey(name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (days) q = q.gte('created_at', new Date(Date.now() - days * 86400000).toISOString());
  if (sp.project) q = q.or(`project_id.eq.${sp.project},target_project_id.eq.${sp.project}`);
  const [{ data }, { data: pendingAll }, projects] = await Promise.all([
    q,
    supabase
      .from('budget_changes')
      .select('id, kind, amount, budget_before, budget_after, project_id, target_project_id, reason, reference, note, status, created_at, requested_by, decline_note, requester:profiles!budget_changes_requested_by_fkey(full_name), signer:profiles!budget_changes_signed_off_by_fkey(full_name), project:projects!budget_changes_project_id_fkey(name), target:projects!budget_changes_target_project_id_fkey(name)')
      .eq('status', 'pending')
      .order('created_at'),
    getProjects(supabase, company)
  ]);
  const rows = (data ?? []) as unknown as Chg[];
  const pending = (pendingAll ?? []) as unknown as Chg[];
  const forMe = pending.filter((c) => c.requested_by !== profile.id);
  const mine = pending.filter((c) => c.requested_by === profile.id);
  const byId = new Map(projects.map((p) => [p.id, p]));

  const href = (o: Record<string, string>) => '/budget-changes?' + new URLSearchParams({ ...(sp.project ? { project: sp.project } : {}), ...(sp.days ? { days: sp.days } : {}), ...o }).toString();

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Budget changes</h1>
          <span className="muted">{forMe.length} waiting for your sign-off · every change is logged with who, when and why</span>
        </div>
        <Link href="/budget/change" className="btn dark">Change a budget</Link>
      </div>

      {forMe.map((c) => {
        const p = byId.get(c.project_id);
        const spent = p?.spent ?? 0;
        const held = p?.held ?? 0;
        const floor = spent + held;
        const afterBudget = c.kind === 'set' ? Number(c.budget_after) : (p?.budget ?? Number(c.budget_before)) - Number(c.amount);
        const before = p?.budget ?? Number(c.budget_before);
        const leftBefore = before - spent;
        const leftAfter = afterBudget - spent;
        const burn = p?.daily_burn ?? 0;
        const scale = Math.max(before, 1);
        const w = (v: number) => `${Math.max(0, (v / scale) * 100).toFixed(1)}%`;
        const verb = c.kind === 'move' ? `move ${cur} ${whole(c.amount)} from ${c.project?.name} to ${c.target?.name}` : `${c.kind === 'set' ? 'set' : 'decrease'} ${c.project?.name} ${c.kind === 'set' ? 'to' : 'by'} ${cur} ${whole(c.kind === 'set' ? c.budget_after : c.amount)}`;
        return (
          <section key={c.id} aria-label="Waiting for sign-off" className="card clip" style={{ borderColor: 'var(--field)' }}>
            <div className="row wrap between" style={{ padding: '18px 22px', background: 'var(--chip)' }}>
              <div className="row" style={{ gap: 12 }}>
                <span className="av dark s40">{initials(c.requester?.full_name)}</span>
                <span className="col" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 700 }}>{c.requester?.full_name} asks to {verb}</span>
                  <span className="s13 ink2">Requested {when(c.created_at, tz).toLowerCase()} · needs a second admin because it’s over {cur} {whole(company.signoff_above)}</span>
                </span>
              </div>
              <span className="pill lg white" style={{ padding: '4px 10px' }}>Waiting for you</span>
            </div>
            <div className="row wrap" style={{ padding: 22, gap: 24, alignItems: 'flex-start' }}>
              <div className="col" style={{ flex: '1 1 320px', gap: 14 }}>
                <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px 18px', fontSize: 13 }}>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Reason</dt><dd style={{ margin: 0, fontWeight: 600 }}>{c.reason ?? '—'}{c.reference ? ` · ${c.reference}` : ''}</dd></div>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Type</dt><dd style={{ margin: 0, fontWeight: 600, textTransform: 'capitalize' }}>{c.kind}</dd></div>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Budget</dt><dd className="mono" style={{ margin: 0, fontWeight: 600 }}>{whole(before)} → {whole(afterBudget)}</dd></div>
                  <div className="col" style={{ gap: 3 }}><dt className="muted">Left after</dt><dd className="mono" style={{ margin: 0, fontWeight: 600 }}>{whole(leftBefore)} → {whole(leftAfter)}</dd></div>
                </dl>
                {c.note ? <div style={{ background: 'var(--panel-2)', borderRadius: 10, padding: '12px 14px', fontSize: 13, lineHeight: 1.5 }}><b>{firstName(c.requester?.full_name)} wrote:</b> {c.note}</div> : null}
                <div className="col" style={{ gap: 8 }}>
                  <span className="s13" style={{ fontWeight: 600 }}>Checks</span>
                  <span className="row s13" style={{ gap: 10 }}>
                    <span className="av dark" style={{ width: 20, height: 20, fontSize: 11, background: afterBudget >= floor ? 'var(--ink)' : 'var(--signal-dark)' }}>{afterBudget >= floor ? '✓' : '!'}</span>
                    {afterBudget >= floor ? `Stays above spent + held (${cur} ${whole(floor)})` : `Would drop below spent + held (${cur} ${whole(floor)}) — can’t be signed off`}
                  </span>
                  <span className="row s13" style={{ gap: 10 }}>
                    <span className="av dark" style={{ width: 20, height: 20, fontSize: 11, background: c.reference ? 'var(--ink)' : 'var(--signal-dark)' }}>{c.reference ? '✓' : '!'}</span>
                    {c.reference ? `Reference ${c.reference} given` : 'No reference given'}
                  </span>
                  {burn > 0 ? (
                    <span className="row s13" style={{ gap: 10 }}>
                      <span className="av dark" style={{ width: 20, height: 20, fontSize: 12, background: 'var(--signal-dark)' }}>!</span>
                      Runway drops from {Math.floor(leftBefore / burn)} to {Math.max(0, Math.floor(leftAfter / burn))} days
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="col" style={{ flex: '1 1 320px', gap: 14 }}>
                <div className="col" style={{ gap: 8 }}>
                  <span className="s13 ink2" style={{ fontWeight: 600 }}>Now</span>
                  <div className="stack" style={{ height: 18, gap: 2 }}><div className="spent" style={{ width: w(spent) }} /><div className="held" style={{ width: w(held) }} /><div className="left" style={{ width: w(before - floor) }} /></div>
                  <span className="s13 ink2" style={{ fontWeight: 600 }}>After</span>
                  <div className="stack" style={{ height: 18, gap: 2 }}>
                    <div className="spent" style={{ width: w(spent) }} /><div className="held" style={{ width: w(held) }} />
                    <div className="left" style={{ width: w(afterBudget - floor), borderRadius: 0 }} />
                    <div style={{ width: w(before - afterBudget), background: 'repeating-linear-gradient(135deg, #EDEDEF 0 4px, #FFFFFF 4px 8px)', border: '1px dashed #BDBDC2' }} />
                  </div>
                </div>
                <SignOffForm id={c.id} who={firstName(c.requester?.full_name)} label={c.kind === 'move' ? `Sign off — move ${cur} ${whole(c.amount)}` : c.kind === 'set' ? `Sign off — set to ${cur} ${whole(c.budget_after)}` : `Sign off — reduce by ${cur} ${whole(c.amount)}`} />
              </div>
            </div>
          </section>
        );
      })}
      {mine.length ? (
        <div className="notice">
          You have {mine.length} change{mine.length > 1 ? 's' : ''} waiting for another admin: {mine.map((c) => `${c.project?.name} (${c.kind} ${whole(c.amount)})`).join(', ')}.
        </div>
      ) : null}

      <section aria-label="History" className="card clip">
        <div className="card-head" style={{ padding: '16px 20px' }}>
          <h2 className="h2">All changes</h2>
          <div className="row wrap" style={{ gap: 8 }}>
            <form action="/budget-changes" className="row" style={{ gap: 8 }}>
              {sp.days ? <input type="hidden" name="days" value={sp.days} /> : null}
              <select name="project" aria-label="Project" className="input sm" defaultValue={sp.project ?? ''} style={{ width: 200 }}>
                <option value="">All projects</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <button className="btn md">Filter</button>
            </form>
            <Link href={href({ days: days === 90 ? 'all' : '90' })} className="btn md">{days ? `Last ${days} days` : 'All time'}</Link>
            <a href="/api/export/changes" className="btn md">Export</a>
          </div>
        </div>
        <div className="tbl">
          <div className="tbl-inner" style={{ ['--minw' as string]: '820px', ['--cols' as string]: '90px 1.4fr 2fr 1fr 1fr 1.2fr' }}>
            <div className="tr th"><span>When</span><span>Project</span><span>Change</span><span>By</span><span>Signed off</span><span className="right">Budget</span></div>
            {rows.map((h) => {
              const tag = TAG[h.kind] ?? { t: h.kind };
              const why = [h.kind === 'fund' ? 'Funds added' : h.kind === 'opening' ? 'Opening budget' : h.reason, h.reference, h.status === 'pending' ? 'waiting' : h.status === 'declined' ? `declined: ${h.decline_note ?? ''}` : null].filter(Boolean).join(' · ');
              return (
                <div key={h.id} className="tr" style={{ padding: '13px 20px' }}>
                  <span className="mono small">{dayMonth(h.created_at, tz)}</span>
                  <span style={{ fontWeight: 600 }}>{h.kind === 'move' ? `${h.project?.name} → ${h.target?.name}` : h.project?.name}</span>
                  <span className="row" style={{ gap: 10, minWidth: 0 }}><span className={`tag ${tag.red ? 'red' : ''}`}>{tag.t}</span><span className="s13 ink2">{why}</span></span>
                  <span className="s13">{shortName(h.requester?.full_name)}</span>
                  <span className="s13 muted">{h.status === 'pending' ? (h.requested_by === profile.id ? 'Pending — another admin' : 'Pending — you') : h.signer ? shortName(h.signer.full_name) : 'Not needed'}</span>
                  <span className="mono right">{h.kind === 'move' ? `−${whole(h.amount)} / +${whole(h.amount)}` : `${whole(h.budget_before)} → ${whole(h.budget_after)}`}</span>
                </div>
              );
            })}
            {!rows.length ? <div className="empty">No budget changes in this period.</div> : null}
          </div>
        </div>
      </section>
    </>
  );
}
