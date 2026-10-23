'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createProject } from '@/lib/actions';
import { parseAmount } from '@/lib/format';
import { ProofPicker } from '@/components/ui/ProofPicker';
import type { Uploaded } from '@/components/ui/upload';

export function NewProjectForm({ companyId, currency }: { companyId: string; currency: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await createProject({ name, amount: parseAmount(amount), file });
    if (r.error) {
      setBusy(false);
      setError(r.error);
      return;
    }
    router.push(`/projects/${r.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card form">
      <div className="field">
        <label htmlFor="name">Project name</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Site office fit-out" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="amount">Starting budget ({currency})</label>
        <input id="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
      </div>
      <div className="field">
        <label>Proof of the budget</label>
        <ProofPicker companyId={companyId} folder="funding" value={file} onChange={setFile} hint="Add transfer slip, cheque photo or approval" />
      </div>
      {error ? <div role="alert" className="alert">{error}</div> : null}
      <button className="btn primary lg" disabled={busy}>{busy ? 'Creating…' : 'Create project'}</button>
    </form>
  );
}
