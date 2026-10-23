'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addFunds } from '@/lib/actions';
import { Icon } from '@/components/Icon';
import { ProofPicker } from '@/components/ui/ProofPicker';
import type { Uploaded } from '@/components/ui/upload';
import { parseAmount, whole } from '@/lib/format';

const METHODS = [
  ['bank_transfer', 'Bank transfer', 'Transfer reference'],
  ['cheque', 'Cheque', 'Cheque number'],
  ['cash', 'Cash', 'Handed to'],
  ['card_topup', 'Card top-up', 'Card ending']
] as const;

export function AddFundsForm({
  companyId, currency, me, projects, initialProject, today
}: { companyId: string; currency: string; me: string; projects: { id: string; name: string; left: number }[]; initialProject: string; today: string }) {
  const router = useRouter();
  const [pid, setPid] = useState(initialProject);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState(0);
  const [reference, setReference] = useState('');
  const [received, setReceived] = useState(today);
  const [proof, setProof] = useState<Uploaded | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ref: string; at: string } | null>(null);

  const current = projects.find((p) => p.id === pid);
  const disabled = !proof || !amount || !current;
  const label = !current ? 'Pick a project' : !amount ? 'Enter an amount' : !proof ? 'Attach proof to continue' : `Add ${currency} ${whole(amount)}`;

  async function submit() {
    if (disabled || busy) return;
    setBusy(true);
    setError(null);
    const r = await addFunds({ project_id: pid, amount, method: METHODS[method][0], reference, received_on: received, proof_path: proof!.path, proof_name: proof!.name, note });
    setBusy(false);
    if (r.error) return setError(r.error);
    setDone({ ref: r.ok!, at: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) });
    router.refresh();
  }

  if (!projects.length)
    return (
      <div className="sheet">
        <div className="sheet-body">
          <h1 className="h1 sm">No active projects</h1>
          <span className="muted">Create a project first — its opening budget is its first funding.</span>
          <Link href="/projects/new" className="btn dark lg">Set up a project</Link>
        </div>
      </div>
    );

  if (done && current)
    return (
      <div className="sheet">
        <div className="sheet-body" style={{ padding: '48px 40px', gap: 22 }}>
          <div className="brand-mark" style={{ width: 64, height: 64, borderRadius: 16 }}><Icon name="check" size={30} stroke="#fff" width={2.6} /></div>
          <h1 className="h1" style={{ fontSize: 34, lineHeight: 1.1 }}>{currency} {whole(amount)} added to {current.name}</h1>
          <div className="card" style={{ borderRadius: 12 }}>
            {[
              ['Ledger entry', done.ref],
              [METHODS[method][2], reference || '—'],
              ['Proof', proof?.name ?? ''],
              ['Added by', `${me} · ${done.at}`],
              ['New balance', `${currency} ${whole(current.left + amount)}`]
            ].map(([k, v]) => (
              <div key={k} className="row between s13" style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-3)' }}><span className="muted">{k}</span><span className="mono">{v}</span></div>
            ))}
          </div>
          <div className="row">
            <Link href={`/projects/${pid}`} className="btn dark lg">View in ledger</Link>
            <button type="button" className="btn lg" onClick={() => { setDone(null); setAmount(0); setProof(null); setReference(''); setNote(''); }}>Add another</button>
          </div>
        </div>
      </div>
    );

  return (
    <div className="sheet">
      <div className="sheet-head">
        <div className="col" style={{ gap: 6 }}>
          <span className="eyebrow">Money in</span>
          <h1 className="h1 sm">Add funds to a project</h1>
          <span className="muted" style={{ lineHeight: 1.45 }}>Every top-up needs proof. It’s stored with the ledger entry so anyone auditing can see where the money came from.</span>
        </div>
        <Link href={current ? `/projects/${pid}` : '/overview'} aria-label="Close" className="icon-btn" style={{ width: 44, height: 44, borderRadius: 10, borderColor: 'var(--line)', flex: 'none' }}><Icon name="close" size={16} width={2.2} /></Link>
      </div>
      <div className="sheet-body">
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="label" style={{ padding: 0, marginBottom: 8 }}>1 · Project</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {projects.map((p) => {
              const on = p.id === pid;
              return (
                <button key={p.id} type="button" aria-pressed={on} onClick={() => setPid(p.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minHeight: 64, padding: '10px 14px', borderRadius: 11, cursor: 'pointer', border: on ? '2px solid var(--ink)' : '1px solid var(--line)', background: on ? '#fff' : 'var(--panel-2)' }}>
                  <span style={{ fontWeight: 600, textAlign: 'left' }}>{p.name}</span>
                  <span className="mono small muted">{whole(p.left)} left</span>
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="col" style={{ gap: 10 }}>
          <label htmlFor="amt" className="label">2 · Amount</label>
          <div className="amount-box" style={{ height: 68, padding: '0 18px' }}>
            <span className="cur">{currency}</span>
            <input id="amt" inputMode="decimal" value={amount ? whole(amount) : ''} placeholder="0" onChange={(e) => setAmount(Math.round(parseAmount(e.target.value)))} style={{ fontSize: 34 }} />
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {[10000, 25000, 50000, 100000].map((v) => (
              <button key={v} type="button" className="chip mono s13" onClick={() => setAmount(v)}>{whole(v)}</button>
            ))}
          </div>
        </div>
        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <legend className="label" style={{ padding: 0, marginBottom: 8 }}>3 · How was it paid in?</legend>
          <div className="seg big">
            {METHODS.map((m, i) => <button key={m[0]} type="button" aria-pressed={method === i} onClick={() => setMethod(i)}>{m[1]}</button>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <div className="field"><label htmlFor="ref" className="s13 ink2" style={{ fontWeight: 400 }}>{METHODS[method][2]}</label><input id="ref" className="input mono" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="field"><label htmlFor="dt" className="s13 ink2" style={{ fontWeight: 400 }}>Date received</label><input id="dt" type="date" className="input" value={received} onChange={(e) => setReceived(e.target.value)} /></div>
          </div>
        </fieldset>
        <div className="col" style={{ gap: 10 }}>
          <div className="row between" style={{ alignItems: 'baseline' }}><span className="label">4 · Proof</span><span className="small red" style={{ fontWeight: 600 }}>Required</span></div>
          <ProofPicker companyId={companyId} folder="funding" value={proof} onChange={setProof} />
        </div>
        <div className="field">
          <label htmlFor="note">Note <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input id="note" className="input" placeholder="e.g. Phase 2 materials, approved in site meeting" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {error ? <div role="alert" className="alert">{error}</div> : null}
      </div>
      <div className="sheet-foot">
        {current ? (
          <div className="row between">
            <span className="s13 ink2">{current.name}</span>
            <span className="row mono" style={{ gap: 10 }}>
              <span className="muted">{whole(current.left)}</span><span aria-hidden="true">→</span>
              <span style={{ fontWeight: 600, fontSize: 17, background: 'var(--signal)', color: '#fff', padding: '2px 8px', borderRadius: 6 }}>{whole(current.left + amount)}</span>
            </span>
          </div>
        ) : null}
        <div className="row">
          <Link href={current ? `/projects/${pid}` : '/overview'} className="btn lg">Cancel</Link>
          <button type="button" className="btn dark lg block" aria-disabled={disabled} disabled={disabled || busy} onClick={submit}>{busy ? 'Adding…' : label}</button>
        </div>
      </div>
    </div>
  );
}
