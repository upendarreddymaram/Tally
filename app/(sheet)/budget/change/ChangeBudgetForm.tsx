'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { requestBudgetChange } from '@/lib/actions';
import { Icon } from '@/components/Icon';
import { dayMonth, firstName, parseAmount, shortName, whole } from '@/lib/format';

type P = { id: string; name: string; code: string; budget: number; spent: number; held: number };
type H = {
  id: string; kind: string; amount: number; budget_before: number; budget_after: number; status: string; created_at: string; project_id: string; target_project_id: string | null;
  requester: { full_name: string } | null; signer: { full_name: string } | null; project: { name: string } | null; target: { name: string } | null;
};
type Mode = 'increase' | 'decrease' | 'move' | 'set';
const MODES: Record<Mode, string> = { increase: 'Increase', decrease: 'Decrease', move: 'Move', set: 'Set exact' };
const REASONS = ['Scope change', 'Correcting a mistake', 'Moving money between projects', 'Client variation order'];

export function ChangeBudgetForm({ currency, signoffAbove, signer, projects, projectId, history, tz }: {
  currency: string; signoffAbove: number; signer: string | null; projects: P[]; projectId: string; history: H[]; tz: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('increase');
  const [amount, setAmount] = useState(0);
  const p = projects.find((x) => x.id === projectId);
  const others = projects.filter((x) => x.id !== projectId);
  const [target, setTarget] = useState(others[0]?.id ?? '');
  const [reason, setReason] = useState(REASONS[0]);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  if (!p)
    return (
      <div className="sheet"><div className="sheet-body"><h1 className="h1 sm">No active projects</h1><Link href="/projects/new" className="btn dark lg">Set up a project</Link></div></div>
    );

  const floor = p.spent + p.held;
  const next = mode === 'increase' ? p.budget + amount : mode === 'set' ? amount : p.budget - amount;
  const tooLow = next < floor;
  const reduces = next < p.budget;
  const needsSignoff = reduces && p.budget - next > signoffAbove;
  const signerName = signer ? firstName(signer) : 'another admin';
  const disabled = tooLow || !amount || (mode === 'move' && !target) || !note.trim();
  const t = projects.find((x) => x.id === target);

  const scale = Math.max(p.budget, next, floor, 1) * 1.02;
  const pct = (v: number) => `${((Math.max(0, v) / scale) * 100).toFixed(2)}%`;
  const bar = (label: string, b: number, bp: P = p) => {
    const f = bp.spent + bp.held;
    const sc = bp === p ? scale : Math.max(b, f, 1) * 1.02;
    const w = (v: number) => `${((Math.max(0, v) / sc) * 100).toFixed(2)}%`;
    return (
      <div className="col" style={{ gap: 8 }} key={label}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="s13 ink2" style={{ fontWeight: 600 }}>{label}</span>
          <span className="mono s13">Budget <b>{whole(b)}</b> · left <b>{whole(Math.max(0, b - f))}</b></span>
        </div>
        <div className="stack" style={{ height: 18, gap: 2 }}>
          <div className="spent" style={{ width: w(bp.spent), background: 'var(--ink)' }} />
          <div className="held" style={{ width: w(bp.held), minWidth: bp.held ? 3 : 0 }} />
          <div className={b < f ? 'bad' : 'left'} style={{ width: w(Math.max(0, b - f)) }} />
        </div>
      </div>
    );
  };

  const submitLabel = disabled
    ? tooLow || !amount ? 'Fix the amount to continue' : !note.trim() ? 'Say what changed to continue' : 'Pick a project to move to'
    : needsSignoff
      ? `Send ${mode === 'move' ? 'move ' : ''}to ${signerName} for sign-off`
      : { increase: `Add ${currency} ${whole(amount)} to budget`, decrease: `Reduce by ${currency} ${whole(amount)}`, move: `Move ${currency} ${whole(amount)}`, set: `Set budget to ${currency} ${whole(amount)}` }[mode];

  async function submit() {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    const r = await requestBudgetChange({ project_id: p!.id, kind: mode, amount, target_id: mode === 'move' ? target : null, reason, reference, note });
    setBusy(false);
    if (r.error) return setError(r.error);
    setResult(r.ok === 'pending' ? `Sent to ${signerName} for sign-off. Nothing changes until it’s approved.` : 'Budget updated and logged.');
    router.refresh();
  }

  if (result)
    return (
      <div className="sheet">
        <div className="sheet-body" style={{ padding: '48px 40px', gap: 22 }}>
          <div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 16 }}><Icon name="check" size={30} stroke="#fff" width={2.6} /></div>
          <h1 className="h1" style={{ fontSize: 30, lineHeight: 1.1 }}>{result}</h1>
          <div className="row">
            <Link href={`/projects/${p.id}`} className="btn dark lg">Back to project</Link>
            <Link href="/budget-changes" className="btn lg">All budget changes</Link>
          </div>
        </div>
      </div>
    );

  return (
    <div className="sheet">
      <div className="sheet-head">
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow" style={{ letterSpacing: '0.08em' }}>Admins only · logged</span>
          <h1 className="h1 sm">Change a budget</h1>
          <select aria-label="Project" className="input sm" style={{ maxWidth: 360 }} value={p.id} onChange={(e) => router.replace(`/budget/change?project=${e.target.value}`)}>
            {projects.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.code}</option>)}
          </select>
        </div>
        <Link href={`/projects/${p.id}`} aria-label="Close" className="icon-btn" style={{ width: 44, height: 44, borderRadius: 10, borderColor: 'var(--line)', flex: 'none' }}><Icon name="close" size={16} width={2.2} /></Link>
      </div>
      <div className="sheet-body" style={{ gap: 20 }}>
        <div role="group" aria-label="Type of change" className="seg big">
          {(Object.keys(MODES) as Mode[]).map((k) => (
            <button key={k} type="button" aria-pressed={mode === k} disabled={k === 'move' && !others.length} onClick={() => { setMode(k); setAmount(0); }}>{MODES[k]}</button>
          ))}
        </div>
        <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: '1 1 220px', gap: 8 }}>
            <label htmlFor="amt">{mode === 'set' ? 'New total budget' : mode === 'increase' ? 'Increase by' : mode === 'move' ? 'Move this much out' : 'Decrease by'}</label>
            <div className={`amount-box ${tooLow && amount ? 'bad' : ''}`}>
              <span className="cur">{mode === 'increase' ? '+' : mode === 'set' ? '=' : '−'} {currency}</span>
              <input id="amt" inputMode="decimal" value={amount ? whole(amount) : ''} placeholder="0" onChange={(e) => setAmount(Math.round(parseAmount(e.target.value)))} />
            </div>
          </div>
          {mode === 'move' ? (
            <div className="field" style={{ flex: '1 1 200px', gap: 8 }}>
              <label htmlFor="to">Move it to</label>
              <select id="to" className="input" style={{ height: 62, borderRadius: 12 }} value={target} onChange={(e) => setTarget(e.target.value)}>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          ) : null}
        </div>
        {tooLow && amount ? (
          <div role="alert" className="alert">
            <Icon name="warn" size={16} width={2.2} />
            <span>That would leave {currency} {whole(next)}, but {currency} {whole(floor)} is already spent or held for pending claims. The lowest you can go is {whole(floor)}.</span>
          </div>
        ) : null}
        <section aria-label="Before and after" className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {bar('Now', p.budget)}
          {bar(tooLow ? 'After — not allowed' : 'After this change', Math.max(0, next))}
          {mode === 'move' && t ? bar(`${t.name} after`, t.budget + amount, t) : null}
          <div className="row wrap small ink2" style={{ gap: 16 }}>
            <span className="row" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--ink)' }} />Spent {whole(p.spent)}</span>
            <span className="row" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--held)' }} />Held {whole(p.held)}</span>
            <span className="row" style={{ gap: 6 }}><span className="swatch" style={{ background: 'var(--signal)', border: '1px solid var(--signal-dark)' }} />Left to spend</span>
          </div>
        </section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div className="field">
            <label htmlFor="reason">Reason</label>
            <select id="reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="ref">Reference <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input id="ref" className="input mono" placeholder="e.g. VO-014" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="why">What changed? <span className="muted" style={{ fontWeight: 400 }}>(required — the team sees this)</span></label>
          <textarea id="why" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {needsSignoff && !tooLow ? (
          <div className="notice">
            <span className="av dark s36">{signer ? signer.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?'}</span>
            <span><b>{signer ?? 'Another admin'} needs to sign off.</b> Decreases and moves above {currency} {whole(signoffAbove)} need a second admin. Nothing changes until {signer ? 'they approve' : 'someone approves'}.</span>
          </div>
        ) : null}
        {error ? <div role="alert" className="alert">{error}</div> : null}
        <section aria-labelledby="histHead" className="col" style={{ gap: 8 }}>
          <h2 id="histHead" className="eyebrow" style={{ margin: 0, fontWeight: 500, letterSpacing: '0.08em' }}>Earlier changes to this budget</h2>
          {history.map((h) => {
            const incoming = h.target_project_id === p.id;
            const what =
              h.kind === 'opening' ? 'Opening budget' : h.kind === 'fund' ? 'Funds added' : h.kind === 'move' ? (incoming ? `Moved ${whole(h.amount)} in from ${h.project?.name}` : `Moved ${whole(h.amount)} to ${h.target?.name}`) : `${MODES[h.kind as Mode] ?? h.kind}`;
            return (
              <div key={h.id} className="kv">
                <span>{dayMonth(h.created_at, tz)} · {what} · {shortName(h.requester?.full_name)}{h.signer ? `, signed off by ${shortName(h.signer.full_name)}` : ''}{h.status !== 'applied' ? ` · ${h.status}` : ''}</span>
                <span className="mono nowrap">{incoming ? `+${whole(h.amount)}` : `${whole(h.budget_before)} → ${whole(h.budget_after)}`}</span>
              </div>
            );
          })}
          {!history.length ? <span className="s13 muted">No changes yet.</span> : null}
        </section>
      </div>
      <div className="sheet-foot" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Link href={`/projects/${p.id}`} className="btn lg">Cancel</Link>
        <button type="button" className="btn dark lg block" aria-disabled={disabled} disabled={disabled || busy} onClick={submit}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </div>
  );
}
