'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { addFunds } from '@/lib/actions';
import { FUND_METHOD_LABEL, parseAmount } from '@/lib/format';
import { ProofPicker } from '@/components/ui/ProofPicker';
import type { Uploaded } from '@/components/ui/upload';

export function FundsForm({
  companyId, currency, projects, initialProject
}: { companyId: string; currency: string; projects: { id: string; name: string }[]; initialProject: string }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await addFunds({ project_id: project, amount: parseAmount(amount), method, reference, note, file });
    if (r.error) {
      setBusy(false);
      setError(r.error);
      return;
    }
    router.push(`/projects/${project}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card form">
      <div className="field">
        <label htmlFor="project">Project</label>
        <select id="project" className="input" value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="amount">Amount ({currency})</label>
        <input id="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="method">How was it received?</label>
        <select id="method" className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
          {Object.entries(FUND_METHOD_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="ref">Reference <span className="muted">(optional)</span></label>
        <input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer or cheque number" />
      </div>
      <div className="field">
        <label htmlFor="note">Note <span className="muted">(optional)</span></label>
        <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label>Proof</label>
        <ProofPicker companyId={companyId} folder="funding" value={file} onChange={setFile} hint="Add transfer slip, cheque photo or receipt" />
      </div>
      {error ? <div role="alert" className="alert">{error}</div> : null}
      <button className="btn primary lg" disabled={busy}>{busy ? 'Saving…' : 'Add funds'}</button>
    </form>
  );
}
