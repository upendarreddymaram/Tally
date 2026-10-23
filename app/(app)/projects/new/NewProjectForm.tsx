'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/actions';
import { ProofPicker } from '@/components/ui/ProofPicker';
import type { Uploaded } from '@/components/ui/upload';
import { initials, parseAmount, ROLE_LABEL, whole } from '@/lib/format';
import type { Profile } from '@/lib/types';

type Person = Pick<Profile, 'id' | 'full_name' | 'role' | 'last_seen_at'>;
const METHODS = [
  ['bank_transfer', 'Bank transfer', 'Transfer reference'],
  ['cheque', 'Cheque', 'Cheque number'],
  ['cash', 'Cash handed to lead', 'Handed to'],
  ['card_topup', 'Card top-up', 'Card ending']
] as const;

export function NewProjectForm({
  companyId, currency, me, nextCode, people, defaults
}: {
  companyId: string; currency: string; me: string; nextCode: string; people: Person[];
  defaults: { receipt: number; auto: number; admin: number; alert: number; limit: number; workersSee: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [code, setCode] = useState(nextCode);
  const [starts, setStarts] = useState('');
  const [ends, setEnds] = useState('');
  const [lead, setLead] = useState(me);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>('bank_transfer');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<Uploaded | null>(null);
  const [team, setTeam] = useState<Record<string, { on: boolean; limit: string }>>(() =>
    Object.fromEntries(people.map((p) => [p.id, { on: p.id === me, limit: whole(p.id === me ? defaults.limit * 3 : defaults.limit) }]))
  );
  const [rules, setRules] = useState({ receipt: whole(defaults.receipt), auto: whole(defaults.auto), admin: whole(defaults.admin), alert: String(defaults.alert) });
  const [workersSee, setWorkersSee] = useState(defaults.workersSee);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = useMemo(() => people.filter((p) => team[p.id]?.on || p.id === lead), [people, team, lead]);
  const amountText = whole(amount);
  const missing = !name.trim() ? 'Name the project' : !code.trim() ? 'Give it a code' : !amount ? 'Enter the opening budget' : !proof ? 'Attach proof to continue' : null;

  async function submit() {
    if (missing) return;
    setBusy(true);
    setError(null);
    const r = (v: string) => (v.trim() === '' ? null : parseAmount(v));
    const res = await createProject({
      name: name.trim(), code: code.trim().toUpperCase(), starts_on: starts, ends_on: ends, lead_id: lead, amount, method, reference,
      proof_path: proof!.path, proof_name: proof!.name,
      members: chosen.map((p) => ({ user_id: p.id, monthly_limit: parseAmount(team[p.id]?.limit ?? String(defaults.limit)) })),
      rules: {
        receipt: r(rules.receipt) === defaults.receipt ? null : r(rules.receipt),
        auto: r(rules.auto) === defaults.auto ? null : r(rules.auto),
        admin: r(rules.admin) === defaults.admin ? null : r(rules.admin),
        alert: r(rules.alert) === defaults.alert ? null : r(rules.alert),
        workersSee
      }
    });
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    router.push(`/projects/${res.ok}`);
    router.refresh();
  }

  const steps = ['Details', 'Opening budget', 'People & limits', 'Rules'];
  const ruleRows = [
    ['receipt', 'Receipt photo required above', currency],
    ['auto', 'Auto-approve with receipt attached up to', currency],
    ['admin', 'Admin approval above', currency],
    ['alert', 'Alert when budget left falls below', '%']
  ] as const;

  return (
    <>
      <ol aria-label="Steps" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {steps.map((s, i) => (
          <li key={s} className="row" style={{ gap: 8, height: 36, padding: '0 12px 0 6px', borderRadius: 999, fontSize: 13, fontWeight: 600, background: '#fff', border: '1px solid var(--line)' }}>
            <span className="av dark" style={{ width: 24, height: 24, fontSize: 12 }}>{i + 1}</span>{s}
          </li>
        ))}
      </ol>
      <div className="split" style={{ gap: 22 }}>
        <section aria-label="Project details" className="card wide" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div className="grid-auto" style={{ ['--min' as string]: '260px' }}>
            <div className="field"><label htmlFor="pn">Project name</label><input id="pn" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Business Bay clinic fit-out" /></div>
            <div className="field"><label htmlFor="pc">Code</label><input id="pc" className="input mono" value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="field"><label htmlFor="ps">Starts</label><input id="ps" type="date" className="input" value={starts} onChange={(e) => setStarts(e.target.value)} /></div>
            <div className="field"><label htmlFor="pe">Expected end</label><input id="pe" type="date" className="input" value={ends} onChange={(e) => setEnds(e.target.value)} /></div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pl">Project lead</label>
              <select id="pl" className="input" value={lead} onChange={(e) => setLead(e.target.value)}>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({ROLE_LABEL[p.role]})</option>)}
              </select>
            </div>
          </div>

          <div className="col" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 22, gap: 14 }}>
            <div className="row between" style={{ alignItems: 'baseline' }}><h2 className="h2">Opening budget</h2><span className="small red" style={{ fontWeight: 600 }}>Proof required</span></div>
            <div className="grid-auto">
              <div className="field">
                <label htmlFor="ob">Amount</label>
                <div className="amount-box" style={{ height: 56 }}>
                  <span className="cur">{currency}</span>
                  <input id="ob" inputMode="decimal" value={amount ? amountText : ''} placeholder="0" onChange={(e) => setAmount(Math.round(parseAmount(e.target.value)))} style={{ fontSize: 28 }} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="src">Paid in by</label>
                <select id="src" className="input" style={{ height: 56 }} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                  {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ref">{METHODS.find((m) => m[0] === method)![2]}</label>
                <input id="ref" className="input mono" style={{ height: 56 }} value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            <ProofPicker companyId={companyId} folder="funding" value={proof} onChange={setProof} />
          </div>

          <div className="col" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 22, gap: 14 }}>
            <h2 className="h2">Who can spend</h2>
            <div className="col" style={{ gap: 6 }}>
              {people.map((p) => {
                const t = team[p.id] ?? { on: false, limit: whole(defaults.limit) };
                const isLead = p.id === lead;
                return (
                  <label key={p.id} className="row" style={{ gap: 12, minHeight: 52, padding: '6px 12px', border: '1px solid var(--line-2)', borderRadius: 10, background: '#fafafa' }}>
                    <input type="checkbox" className="check" checked={t.on || isLead} disabled={isLead} onChange={(e) => setTeam({ ...team, [p.id]: { ...t, on: e.target.checked } })} />
                    <span className="av grey s30">{initials(p.full_name)}</span>
                    <span className="col grow">
                      <span style={{ fontWeight: 600 }}>{p.full_name}</span>
                      <span className="small muted">{ROLE_LABEL[p.role]}{isLead ? ' · lead' : ''}{!p.last_seen_at ? ' · hasn’t signed in yet' : ''}</span>
                    </span>
                    <span className="row small muted" style={{ gap: 6 }}>
                      Monthly limit
                      <input aria-label={`Monthly limit for ${p.full_name}`} className="input num" style={{ width: 84, height: 36 }} value={t.limit} onChange={(e) => setTeam({ ...team, [p.id]: { ...t, limit: e.target.value } })} />
                    </span>
                  </label>
                );
              })}
              <Link href="/team" className="btn md" style={{ alignSelf: 'flex-start' }}>+ Add someone else</Link>
            </div>
          </div>
        </section>

        <section aria-label="Rules" className="narrow">
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 className="h2">Spending rules</h2>
            <span className="small muted">Start from your company defaults. Change any of them for this project.</span>
            {ruleRows.map(([k, label, unit]) => (
              <div key={k} className="row between" style={{ gap: 12, paddingTop: 12, borderTop: '1px solid var(--line-3)' }}>
                <label htmlFor={`r-${k}`} className="s13" style={{ lineHeight: 1.4 }}>{label}</label>
                <div className="row" style={{ gap: 6, flex: 'none' }}>
                  <span className="small muted">{unit}</span>
                  <input id={`r-${k}`} className="input num" style={{ width: 84 }} value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: e.target.value })} />
                </div>
              </div>
            ))}
            <label className="row" style={{ minHeight: 32, paddingTop: 12, borderTop: '1px solid var(--line-3)' }}>
              <input type="checkbox" className="check" checked={workersSee} onChange={(e) => setWorkersSee(e.target.checked)} />Workers can see the project balance
            </label>
          </div>
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--signal-soft)', borderColor: 'var(--signal-line)' }}>
            <span className="mono small red" style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}>What happens next</span>
            <span className="s13" style={{ lineHeight: 1.5 }}>
              The ledger opens with one entry: <b>+{amountText}</b>{reference ? ` from ${reference}` : ''}. {chosen.length} {chosen.length === 1 ? 'person' : 'people'} can then submit claims against it. Nothing can be spent until you press Create.
            </span>
          </div>
          {error ? <div role="alert" className="alert">{error}</div> : null}
          <div className="row">
            <Link href="/projects" className="btn lg">Cancel</Link>
            <button type="button" className="btn dark lg block" disabled={!!missing || busy} onClick={submit}>
              {busy ? 'Creating…' : missing ?? `Create project with ${currency} ${amountText}`}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
