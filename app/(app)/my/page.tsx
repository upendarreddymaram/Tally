import Link from 'next/link';
import type { Metadata } from 'next';
import { PlusChip } from '@/components/Icon';
import { requireMember } from '@/lib/session';
import { firstName, money, PAY_METHOD_LABEL, STATUS_LABEL, when, whole } from '@/lib/format';
import { BankDetails, ReplyForm } from './MyClient';

export const metadata: Metadata = { title: 'My claims' };

type Bal = { project_id: string; name: string; code: string; budget: number | null; spent: number | null; held: number | null; monthly_limit: number | null; used_this_month: number };
type Claim = {
  id: string; ref: string; title: string; amount: number; approved_amount: number | null; status: string; paid_at: string; pay_method: string;
  decision_note: string | null; decision_reason: string | null; reimbursed_at: string | null; project: { name: string } | null; expense_files: { count: number }[];
};

export default async function MyClaimsPage() {
  const { supabase, profile, company } = await requireMember();
  const cur = company.currency;
  const [{ data: balances }, { data: claims }] = await Promise.all([
    supabase.rpc('my_project_balances'),
    supabase
      .from('expenses')
      .select('id, ref, title, amount, approved_amount, status, paid_at, pay_method, decision_note, decision_reason, reimbursed_at, project:projects(name), expense_files(count)')
      .eq('submitted_by', profile.id)
      .order('created_at', { ascending: false })
      .limit(100)
  ]);
  const bals = (balances ?? []) as Bal[];
  const list = (claims ?? []) as unknown as Claim[];
  const replies = list.filter((c) => c.status === 'info_requested');
  const owed = list.filter((c) => c.pay_method === 'own_money' && ['approved', 'part_approved'].includes(c.status) && !c.reimbursed_at).reduce((a, c) => a + Number(c.approved_amount), 0);
  const waiting = list.filter((c) => c.status === 'pending');

  return (
    <div className="col main-narrow" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <span className="eyebrow">{company.name}</span>
          <h1 className="h1">Hi {firstName(profile.full_name)}</h1>
        </div>
        {bals.length ? <Link href="/my/new" className="btn dark lg"><PlusChip />New claim</Link> : null}
      </div>

      {replies.map((c) => (
        <section key={c.id} className="card pad col" style={{ gap: 10, borderColor: 'var(--signal-line)', background: 'var(--signal-soft)' }}>
          <span className="mono small red" style={{ letterSpacing: '0.06em', textTransform: 'uppercase' }}>Reply needed · {c.ref}</span>
          <span style={{ fontWeight: 600 }}>{c.title} · {cur} {money(c.amount)}</span>
          <span className="s13" style={{ lineHeight: 1.5 }}><b>Question:</b> {c.decision_note}</span>
          <ReplyForm expenseId={c.id} companyId={company.id} />
        </section>
      ))}

      <div className="grid-auto" style={{ ['--min' as string]: '180px' }}>
        <div className="card pad col" style={{ gap: 6 }}><span className="small muted">Waiting for approval</span><span className="big" style={{ fontSize: 28 }}>{waiting.length}</span><span className="small muted">{cur} {money(waiting.reduce((a, c) => a + Number(c.amount), 0))}</span></div>
        <div className="card pad col" style={{ gap: 6 }}><span className="small muted">Owed back to you</span><span className="big" style={{ fontSize: 28, color: owed ? 'var(--signal-dark)' : undefined }}>{money(owed)}</span><span className="small muted">Approved own-money claims</span></div>
      </div>

      {bals.length ? (
        <section aria-label="My projects" className="col" style={{ gap: 12 }}>
          <h2 className="h2">My projects</h2>
          <div className="grid-auto" style={{ ['--min' as string]: '240px' }}>
            {bals.map((b) => {
              const lim = Number(b.monthly_limit ?? 0);
              const used = Number(b.used_this_month);
              const pct = lim ? Math.min(100, Math.round((used / lim) * 100)) : 0;
              return (
                <article key={b.project_id} className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="mono small muted">{b.code}</span>
                  <span className="display" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>{b.name}</span>
                  {b.budget !== null ? (
                    <span className="s13 muted">Left to spend <b className="mono" style={{ color: 'var(--ink)' }}>{cur} {whole(Number(b.budget) - Number(b.spent) - Number(b.held))}</b></span>
                  ) : null}
                  {lim ? (
                    <div className="col" style={{ gap: 6 }}>
                      <span className="small muted">Your limit this month</span>
                      <div className="row"><div className="thin"><div className={pct >= 100 ? 'red' : ''} style={{ width: `${pct}%` }} /></div><span className="mono small nowrap">{whole(used)} / {whole(lim)}</span></div>
                    </div>
                  ) : null}
                  <Link href={`/my/new?project=${b.project_id}`} className="btn md">Claim on this project</Link>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="card empty">You’re not on any project yet. Ask your admin to add you, then refresh.</div>
      )}

      <section aria-label="My claims" className="card clip">
        <div className="card-head"><h2 className="h2">My claims</h2></div>
        {list.map((c) => (
          <div key={c.id} className="row" style={{ padding: '12px 20px', borderTop: '1px solid var(--line-3)', gap: 12 }}>
            <span className={`receipt-thumb sm ${(c.expense_files?.[0]?.count ?? 0) > 0 ? '' : 'none'}`} />
            <span className="col grow" style={{ gap: 3 }}>
              <span style={{ fontWeight: 600 }}>{c.title}</span>
              <span className="small muted">
                <span className="mono">{c.ref}</span> · {c.project?.name} · {when(c.paid_at, company.timezone)} · {PAY_METHOD_LABEL[c.pay_method]}
              </span>
              {c.status === 'part_approved' ? <span className="small ink2">Part-approved {money(c.approved_amount)} of {money(c.amount)}{c.decision_reason ? ` — ${c.decision_reason}` : ''}</span> : null}
              {c.status === 'rejected' && c.decision_note ? <span className="small red">Rejected: {c.decision_note}</span> : null}
              {c.reimbursed_at ? <span className="small ink2">Paid back to you {when(c.reimbursed_at, company.timezone)}</span> : null}
            </span>
            <span className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
              <span className="mono" style={{ fontWeight: 600 }}>{money(c.amount)}</span>
              <span className={`pill ${c.status === 'rejected' || c.status === 'info_requested' ? 'red' : c.status === 'pending' ? 'grey' : ''}`}>{STATUS_LABEL[c.status]}</span>
            </span>
          </div>
        ))}
        {!list.length ? <div className="empty" style={{ borderTop: '1px solid var(--line-3)' }}>No claims yet. Tap “New claim” after you buy something for a project.</div> : null}
      </section>

      <BankDetails value={profile.bank_details} />
    </div>
  );
}
