import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { age, dayMonth, initials, money } from '@/lib/format';
import { PayForm } from './PayForm';

export const metadata: Metadata = { title: 'Reimbursements' };

type Row = {
  id: string; ref: string; title: string; approved_amount: number; status: string; decided_at: string | null; submitted_by: string;
  submitter: { full_name: string; bank_details: string | null } | null; project: { name: string } | null;
};

export default async function ReimbursementsPage() {
  const { supabase, company } = await requireAdmin();
  const cur = company.currency;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data: owedRaw }, { data: pendingOwn }, { data: batches }] = await Promise.all([
    supabase
      .from('expenses')
      .select('id, ref, title, approved_amount, status, decided_at, submitted_by, submitter:profiles!expenses_submitted_by_fkey(full_name, bank_details), project:projects(name)')
      .eq('pay_method', 'own_money')
      .in('status', ['approved', 'part_approved'])
      .is('reimbursed_at', null)
      .order('decided_at'),
    supabase.from('expenses').select('amount').eq('pay_method', 'own_money').in('status', ['pending', 'info_requested']),
    supabase.from('reimbursement_batches').select('id, title, reference, total, people, claims, created_at, payer:profiles(full_name)').order('created_at', { ascending: false }).limit(12)
  ]);
  const owed = (owedRaw ?? []) as unknown as Row[];
  const people = new Map<string, { name: string; bank: string | null; projects: Set<string>; total: number; items: Row[] }>();
  for (const r of owed) {
    const p = people.get(r.submitted_by) ?? { name: r.submitter?.full_name ?? '', bank: r.submitter?.bank_details ?? null, projects: new Set<string>(), total: 0, items: [] };
    p.total += Number(r.approved_amount);
    p.items.push(r);
    if (r.project?.name) p.projects.add(r.project.name);
    people.set(r.submitted_by, p);
  }
  const owedTotal = owed.reduce((a, r) => a + Number(r.approved_amount), 0);
  const list = (batches ?? []) as unknown as { id: string; title: string; reference: string | null; total: number; people: number; claims: number; created_at: string }[];
  const paidMonth = list.filter((b) => b.created_at >= monthStart);
  const oldest = owed[0];
  const pendingSum = (pendingOwn ?? []).reduce((a, r) => a + Number(r.amount), 0);

  const stats = [
    { k: 'Owed now', v: `${cur} ${money(owedTotal)}`, n: `${people.size} people · ${owed.length} claims` },
    { k: 'Paid this month', v: `${cur} ${money(paidMonth.reduce((a, b) => a + Number(b.total), 0))}`, n: `${paidMonth.length} batch${paidMonth.length === 1 ? '' : 'es'}` },
    { k: 'Oldest unpaid', v: oldest?.decided_at ? age(oldest.decided_at).replace(' d', ' days').replace(' h', ' hours').replace(' m', ' min') : '—', n: oldest ? `${oldest.submitter?.full_name} · ${oldest.ref}` : 'Nothing owed' }
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Reimbursements</h1>
          <span className="muted">Money people paid from their own pocket and you approved. Pay it back in batches.</span>
        </div>
        {owed.length ? <PayForm label={`Pay all ${people.size} · ${cur} ${money(owedTotal)}`} dark /> : null}
      </div>
      <div className="grid-auto">
        {stats.map((s) => (
          <div key={s.k} className="card pad col" style={{ gap: 6 }}>
            <span className="small muted">{s.k}</span>
            <span className="big" style={{ fontSize: 28, letterSpacing: '-0.03em' }}>{s.v}</span>
            <span className="small muted">{s.n}</span>
          </div>
        ))}
      </div>
      <div className="split" style={{ gap: 22 }}>
        <section aria-label="Owed to people" className="card clip wide">
          <div className="card-head" style={{ padding: '16px 20px' }}><h2 className="h2">Owed right now</h2><span className="s13 muted">Approved, not yet paid</span></div>
          {[...people].map(([id, o]) => (
            <div key={id} className="col" style={{ borderTop: '1px solid var(--line-3)', padding: '14px 20px', gap: 10 }}>
              <div className="row wrap" style={{ gap: 12 }}>
                <span className="av s36">{initials(o.name)}</span>
                <span className="col grow">
                  <span style={{ fontWeight: 600 }}>{o.name}</span>
                  <span className="small muted">{o.bank ? o.bank : 'No bank details yet'} · {[...o.projects].join(', ')}</span>
                </span>
                <span className="mono" style={{ fontSize: 18, fontWeight: 600 }}>{money(o.total)}</span>
                <PayForm person={id} label="Pay" />
              </div>
              <div className="col" style={{ gap: 4, paddingLeft: 48 }}>
                {o.items.map((i) => (
                  <span key={i.id} className="row between s13 ink2">
                    <span><span className="mono muted">{i.ref}</span> · {i.title}{i.status === 'part_approved' ? ' (part-approved)' : ''}</span>
                    <span className="mono">{money(i.approved_amount)}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!people.size ? <div className="empty" style={{ borderTop: '1px solid var(--line-3)' }}>Nobody is owed anything right now.</div> : null}
          {pendingSum ? <div className="card-foot">{cur} {money(pendingSum)} more in own-money claims is still waiting for approval.</div> : null}
        </section>
        <section aria-label="Paid batches" className="narrow">
          <div className="card col" style={{ padding: 20, gap: 12 }}>
            <h2 className="h2">How payouts work</h2>
            <span className="s13 ink2" style={{ lineHeight: 1.5 }}>
              Only claims marked <b>“My own money”</b> land here, and only after approval. Paying marks each claim as reimbursed with your transfer reference, and the person sees it in the app.
              Nothing here changes a project budget — that was already deducted when you approved.
            </span>
          </div>
          <div className="card clip">
            <div style={{ padding: '16px 20px' }}><h2 className="h2">Past batches</h2></div>
            {list.map((b) => (
              <div key={b.id} className="row between" style={{ borderTop: '1px solid var(--line-3)', padding: '12px 20px' }}>
                <span className="col" style={{ gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{b.title}</span>
                  <span className="small muted">{b.people} people · {b.claims} claims{b.reference ? ` · ${b.reference}` : ''} · {dayMonth(b.created_at, company.timezone)}</span>
                </span>
                <span className="col" style={{ alignItems: 'flex-end', gap: 2 }}>
                  <span className="mono" style={{ fontWeight: 600 }}>{money(b.total)}</span>
                  <span style={{ fontSize: 11, fontWeight: 600 }}>Paid{b.reference ? ' · ref recorded' : ''}</span>
                </span>
              </div>
            ))}
            {!list.length ? <div className="empty" style={{ borderTop: '1px solid var(--line-3)' }}>No payouts yet.</div> : null}
          </div>
        </section>
      </div>
    </>
  );
}
