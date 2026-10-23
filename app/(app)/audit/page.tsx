import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon, type IconName } from '@/components/Icon';
import { requireAdmin } from '@/lib/session';
import { dayLabel, initials, time } from '@/lib/format';

export const metadata: Metadata = { title: 'Audit log' };

const KIND: Record<string, { icon: IconName; bg: string; fg: string; label: string }> = {
  money: { icon: 'money', bg: 'var(--chip)', fg: 'var(--ink)', label: 'Money' },
  decide: { icon: 'approvals', bg: 'var(--chip)', fg: 'var(--ink-2)', label: 'Claims & decisions' },
  edit: { icon: 'edit', bg: 'var(--chip)', fg: 'var(--ink)', label: 'Budget & settings edits' },
  login: { icon: 'login', bg: 'var(--panel-2)', fg: 'var(--muted)', label: 'Sign-ins' },
  alert: { icon: 'warn', bg: 'var(--signal-soft)', fg: 'var(--signal-dark)', label: 'Automatic checks' },
  people: { icon: 'people', bg: 'var(--signal-soft)', fg: 'var(--signal-dark)', label: 'People' }
};
const RANGES = { today: 'Today', '7': 'Last 7 days', '30': 'Last 30 days', all: 'All time' } as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ range?: string; who?: string; kind?: string; limit?: string }> }) {
  const sp = await searchParams;
  const { supabase, company } = await requireAdmin();
  const tz = company.timezone;
  const range = sp.range && sp.range in RANGES ? sp.range : '7';
  const limit = Math.min(1000, parseInt(sp.limit ?? '100', 10) || 100);

  let q = supabase.from('audit_log').select('id, kind, text, ref, source, created_at, actor_id, actor:profiles(full_name)').order('created_at', { ascending: false }).limit(limit + 1);
  if (range === 'today') {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    q = q.gte('created_at', d.toISOString());
  } else if (range !== 'all') q = q.gte('created_at', new Date(Date.now() - Number(range) * 86400000).toISOString());
  if (sp.who === 'system') q = q.is('actor_id', null);
  else if (sp.who) q = q.eq('actor_id', sp.who);
  if (sp.kind && sp.kind in KIND) q = q.eq('kind', sp.kind);

  const [{ data }, { data: people }] = await Promise.all([q, supabase.from('profiles').select('id, full_name').order('full_name')]);
  const rows = (data ?? []) as unknown as { id: number; kind: string; text: string; ref: string | null; source: string; created_at: string; actor_id: string | null; actor: { full_name: string } | null }[];
  const more = rows.length > limit;
  const shown = rows.slice(0, limit);
  const qs = (o: Record<string, string>) => new URLSearchParams(Object.fromEntries(Object.entries({ ...sp, ...o }).filter(([, v]) => v)) as Record<string, string>).toString();

  let lastDay = '';
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Audit log</h1>
          <span className="muted">Every sign-in, money movement, decision and edit. Nothing here can be deleted.</span>
        </div>
        <form action="/audit" className="row wrap">
          <select name="range" aria-label="Period" className="input" style={{ height: 44, width: 'auto' }} defaultValue={range}>
            {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select name="who" aria-label="Person" className="input" style={{ height: 44, width: 'auto' }} defaultValue={sp.who ?? ''}>
            <option value="">Everyone</option>
            <option value="system">Tally (automatic)</option>
            {(people ?? []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
          <select name="kind" aria-label="Event type" className="input" style={{ height: 44, width: 'auto' }} defaultValue={sp.kind ?? ''}>
            <option value="">All events</option>
            {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button className="btn">Show</button>
          <a href={`/api/export/audit?${qs({ limit: '' })}`} className="btn dark">Export</a>
        </form>
      </div>
      <section aria-label="Events" className="card clip">
        <div className="tbl">
          <div className="tbl-inner" style={{ ['--minw' as string]: '760px', ['--cols' as string]: '70px 36px 1.2fr 3fr 1fr' }}>
            {shown.map((e) => {
              const day = dayLabel(e.created_at, tz);
              const header = day !== lastDay ? day : null;
              lastDay = day;
              const k = KIND[e.kind] ?? KIND.edit!;
              const who = e.actor?.full_name ?? 'Tally';
              const refHref = e.ref?.startsWith('EXP-') ? `/expenses?q=${e.ref}&period=all` : null;
              return (
                <div key={e.id}>
                  {header ? <div className="eyebrow" style={{ padding: '10px 20px', background: 'var(--panel-2)', borderBottom: '1px solid var(--line-2)' }}>{header}</div> : null}
                  <div className="tr" style={{ gap: 14 }}>
                    <span className="mono small muted">{time(e.created_at, tz)}</span>
                    <span style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: k.bg, color: k.fg }}><Icon name={k.icon} size={15} /></span>
                    <span className="row s13" style={{ gap: 8 }}><span className="av grey s24">{e.actor ? initials(who) : '—'}</span>{who}</span>
                    <span className="s13" style={{ lineHeight: 1.4 }}>
                      {e.text}{' '}
                      {e.ref ? (refHref ? <Link href={refHref} className="mono small">{e.ref}</Link> : <span className="mono small">{e.ref}</span>) : null}
                    </span>
                    <span className="small muted">{e.source}</span>
                  </div>
                </div>
              );
            })}
            {!shown.length ? <div className="empty">No events in this period.</div> : null}
          </div>
        </div>
        {more ? (
          <div className="row" style={{ padding: '14px 20px', justifyContent: 'center' }}>
            <Link href={`/audit?${qs({ limit: String(limit + 100) })}`} className="btn md">Load earlier</Link>
          </div>
        ) : null}
      </section>
    </>
  );
}
