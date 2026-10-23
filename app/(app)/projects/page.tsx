import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon, PlusChip } from '@/components/Icon';
import { requireApprover, isAdminRole } from '@/lib/session';
import { getProjects, runwayText } from '@/lib/queries';
import { dayMonth, initials, whole } from '@/lib/format';

export const metadata: Metadata = { title: 'Projects' };

const SORTS = { runway: 'runway', left: 'left', name: 'name' } as const;

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ show?: string; q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const { supabase, profile, company } = await requireApprover();
  const admin = isAdminRole(profile.role);
  const all = await getProjects(supabase, company);
  const show = sp.show === 'completed' || sp.show === 'all' ? sp.show : 'active';
  const sort = (sp.sort && sp.sort in SORTS ? sp.sort : 'runway') as keyof typeof SORTS;
  const q = (sp.q ?? '').toLowerCase();

  const active = all.filter((p) => p.status === 'active');
  const completed = all.filter((p) => p.status === 'completed');
  let rows = show === 'active' ? active : show === 'completed' ? completed : all;
  if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
  rows = [...rows].sort((a, b) =>
    sort === 'name' ? a.name.localeCompare(b.name) : sort === 'left' ? a.left - b.left : (a.status === 'completed' ? 1 : 0) - (b.status === 'completed' ? 1 : 0) || (a.runway ?? 1e9) - (b.runway ?? 1e9)
  );

  const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
  const { data: fundedYear } = await supabase.from('funding').select('amount').gte('created_at', yearStart);
  const fundedThisYear = (fundedYear ?? []).reduce((a, f) => a + Number(f.amount), 0);

  const tot = active.reduce((a, p) => ({ funded: a.funded + p.budget, spent: a.spent + p.spent, held: a.held + p.held }), { funded: 0, spent: 0, held: 0 });
  const href = (o: Record<string, string>) => '/projects?' + new URLSearchParams({ show, sort, ...(sp.q ? { q: sp.q } : {}), ...o }).toString();
  const nextSort = sort === 'runway' ? 'left' : sort === 'left' ? 'name' : 'runway';
  const cols = '2.4fr 1fr 1.6fr 1fr 1fr 0.9fr 44px';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Projects</h1>
          <span className="muted">{active.length} active · {completed.length} completed{admin ? ` · ${company.currency} ${whole(fundedThisYear)} funded this year` : ''}</span>
        </div>
        {admin ? (
          <div className="row wrap">
            <Link href="/funds/new" className="btn">Add funds</Link>
            <Link href="/projects/new" className="btn dark"><PlusChip />New project</Link>
          </div>
        ) : null}
      </div>
      <div className="row wrap between">
        <div role="group" aria-label="Show" className="seg">
          <Link href={href({ show: 'active' })} aria-current={show === 'active'}>Active {active.length}</Link>
          <Link href={href({ show: 'completed' })} aria-current={show === 'completed'}>Completed {completed.length}</Link>
          <Link href={href({ show: 'all' })} aria-current={show === 'all'}>All {all.length}</Link>
        </div>
        <form className="row" style={{ gap: 8 }} action="/projects">
          <input type="hidden" name="show" value={show} />
          <input type="hidden" name="sort" value={sort} />
          <label htmlFor="q" className="sr-only">Search projects</label>
          <input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Search by name or code" className="input" style={{ height: 42, width: 240 }} />
          <Link href={href({ sort: nextSort })} className="btn" style={{ height: 42 }}>Sort: {sort}</Link>
        </form>
      </div>
      <section aria-label="Projects" className="card clip">
        <div className="tbl">
          <div className="tbl-inner" style={{ ['--minw' as string]: '900px', ['--cols' as string]: cols }}>
            <div className="tr th" style={{ borderTop: 0, padding: '12px 20px' }}>
              <span>Project</span><span>Lead</span><span>Used of budget</span><span className="right">Left ({company.currency})</span><span className="right">Pending</span><span>Runway</span><span />
            </div>
            {rows.map((r) => {
              const done = r.status === 'completed';
              return (
                <div key={r.id} className={`tr ${done ? 'dim' : ''}`} style={{ padding: '14px 20px' }}>
                  <span className="col" style={{ gap: 3, minWidth: 0 }}>
                    <Link href={`/projects/${r.id}`} style={{ fontWeight: 600, textDecoration: 'none' }}>{r.name}</Link>
                    <span className="row small muted" style={{ gap: 8 }}>
                      <span className="mono">{r.code}</span>
                      {r.starts_on ? `· ${dayMonth(r.starts_on)} → ${r.ends_on ? dayMonth(r.ends_on) : '…'}` : null}
                      <span className={`pill ${r.low ? 'red' : done ? 'grey' : ''}`}>{r.low ? 'Low balance' : done ? 'Completed' : 'Active'}</span>
                    </span>
                  </span>
                  <span className="row s13" style={{ gap: 8 }}><span className="av s26">{initials(r.lead_name)}</span>{r.lead_name ?? '—'}</span>
                  <span className="col" style={{ gap: 6 }}>
                    <span className="bar h14"><span className={`fill ${r.low ? 'red' : done ? 'done' : ''}`} style={{ width: `${Math.min(100, r.pct)}%` }} /><span className="ticks" /></span>
                    <span className="small muted"><span className="mono" style={{ color: 'var(--ink)' }}>{whole(r.spent)}</span> of {whole(r.budget)} · {r.pct}%</span>
                  </span>
                  <span className="mono right" style={{ fontWeight: 600 }}>{whole(r.left)}</span>
                  <span className="mono right red">{r.held ? whole(r.held) : '—'}</span>
                  <span className={`mono s13 ${r.low ? 'red' : done ? 'muted' : ''}`} style={{ fontWeight: 600 }}>{runwayText(r)}</span>
                  <Link href={`/projects/${r.id}`} aria-label={`Open ${r.name}`} className="icon-btn ghost"><Icon name="chevron" size={16} width={2.2} /></Link>
                </div>
              );
            })}
            {!rows.length ? <div className="empty">{q ? 'No projects match that search.' : 'No projects here yet.'}</div> : null}
          </div>
        </div>
        <div className="card-foot">
          <span>
            Totals for active projects · funded <b className="mono">{whole(tot.funded)}</b> · spent <b className="mono">{whole(tot.spent)}</b> · held{' '}
            <b className="mono">{whole(tot.held)}</b> · left <b className="mono">{whole(tot.funded - tot.spent - tot.held)}</b>
          </span>
          <a href="/api/export/projects" className="btn sm">Export CSV</a>
        </div>
      </section>
    </>
  );
}
