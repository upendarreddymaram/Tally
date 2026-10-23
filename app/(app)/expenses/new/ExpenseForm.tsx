'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addExpense } from '@/lib/actions';
import { money, parseAmount, stamp } from '@/lib/format';
import { ProofPicker } from '@/components/ui/ProofPicker';
import type { Uploaded } from '@/components/ui/upload';

export function ExpenseForm({
  companyId, currency, tz, projects, initialProject
}: { companyId: string; currency: string; tz: string; projects: { id: string; name: string; remaining: number }[]; initialProject: string }) {
  const router = useRouter();
  const [project, setProject] = useState(initialProject);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<Uploaded | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(stamp(new Date().toISOString(), tz));
    tick();
    const t = setInterval(tick, 15000);
    return () => clearInterval(t);
  }, [tz]);

  const current = projects.find((p) => p.id === project);
  const value = parseAmount(amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await addExpense({ project_id: project, title, amount: value, note, file });
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
        {current ? <span className="small muted">{money(current.remaining, currency)} remaining</span> : null}
      </div>
      <div className="field">
        <label htmlFor="title">What was it for?</label>
        <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Cement bags" required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="amount">Amount ({currency})</label>
        <input id="amount" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
        {current && value > current.remaining ? <span className="small neg">This is more than the {money(current.remaining, currency)} left in the project.</span> : null}
      </div>
      <div className="field">
        <label htmlFor="note">Note <span className="muted">(optional)</span></label>
        <input id="note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label>Proof</label>
        <ProofPicker companyId={companyId} folder="expenses" value={file} onChange={setFile} hint="Add the receipt or a photo" />
      </div>
      <div className="stamp">🕒 Date &amp; time: <b>{now ?? '…'}</b></div>
      {error ? <div role="alert" className="alert">{error}</div> : null}
      <button className="btn primary lg" disabled={busy}>{busy ? 'Saving…' : 'Save expense'}</button>
    </form>
  );
}
