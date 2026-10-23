'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { submitExpense } from '@/lib/actions';
import { Icon } from '@/components/Icon';
import { ACCEPT, kb, uploadProof } from '@/components/ui/upload';
import { money, parseAmount } from '@/lib/format';

const METHODS = [
  ['project_card', 'Project card'],
  ['cash_float', 'Cash float'],
  ['own_money', 'My own money'],
  ['bank_transfer', 'Bank transfer']
] as const;

function localNow() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function NewClaimForm({ companyId, currency, projects, categories, initialProject }: {
  companyId: string; currency: string; projects: { id: string; name: string }[]; categories: { id: string; name: string }[]; initialProject: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [project, setProject] = useState(initialProject);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [vendor, setVendor] = useState('');
  const [amountText, setAmountText] = useState('');
  const [paidAt, setPaidAt] = useState(localNow());
  const [method, setMethod] = useState<(typeof METHODS)[number][0]>('project_card');
  const [last4, setLast4] = useState('');
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const amount = parseAmount(amountText);
  const missing = !title.trim() ? 'Say what you bought' : !amount ? 'Enter the amount' : null;

  async function submit() {
    if (missing || busy) return;
    setBusy(true);
    setError(null);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadProof(companyId, 'expenses', f)));
      const r = await submitExpense({ project_id: project, title: title.trim(), category_id: category || null, vendor: vendor.trim(), amount, paid_at: paidAt, pay_method: method, card_last4: last4, note, files: uploaded });
      if (r.error) throw new Error(r.error);
      setDone(r.ok!);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="card pad-lg col" style={{ gap: 18 }}>
        <div className="brand-mark" style={{ width: 56, height: 56, borderRadius: 14 }}><Icon name="check" size={26} stroke="#fff" width={2.6} /></div>
        <h2 className="h1 sm">Sent · {done}</h2>
        <span className="muted">{currency} {money(amount)} for {title}. You’ll see the decision under My claims.</span>
        <div className="row">
          <Link href="/my" className="btn dark lg">Back to my claims</Link>
          <button type="button" className="btn lg" onClick={() => { setDone(null); setTitle(''); setVendor(''); setAmountText(''); setNote(''); setFiles([]); setPaidAt(localNow()); }}>Add another</button>
        </div>
      </div>
    );

  return (
    <div className="card pad-lg col" style={{ gap: 18 }}>
      <div className="field">
        <label htmlFor="pr">Project</label>
        <select id="pr" className="input" value={project} onChange={(e) => setProject(e.target.value)}>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <div className="col" style={{ gap: 10 }}>
        <span className="label">Receipt photo</span>
        <input ref={input} type="file" accept={ACCEPT} capture="environment" multiple hidden onChange={(e) => { setFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = ''; }} />
        {files.map((f, i) => (
          <div key={i} className="file-card">
            {f.type.startsWith('image/') ? <img src={URL.createObjectURL(f)} alt="" style={{ width: 44, height: 54, objectFit: 'cover', borderRadius: 6 }} /> : <span className="doc-thumb"><span /><span /><span /><span /></span>}
            <span className="col grow"><span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{f.name}</span><span className="small muted">{kb(f.size)}</span></span>
            <button type="button" className="icon-btn ghost" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button>
          </div>
        ))}
        <button type="button" className="btn lg" onClick={() => input.current?.click()}>{files.length ? '+ Add another photo' : 'Take photo or choose file'}</button>
      </div>
      <div className="field"><label htmlFor="ti">What did you buy?</label><input id="ti" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Anchor bolts M12 × 400" /></div>
      <div className="field">
        <label htmlFor="am">Amount</label>
        <div className="amount-box"><span className="cur">{currency}</span><input id="am" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ''))} placeholder="0.00" /></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <div className="field"><label htmlFor="ca">Category</label><select id="ca" className="input" value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Choose…</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div className="field"><label htmlFor="ve">Supplier <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><input id="ve" className="input" value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
        <div className="field"><label htmlFor="pa">Paid on</label><input id="pa" type="datetime-local" className="input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} /></div>
      </div>
      <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <legend className="label" style={{ padding: 0, marginBottom: 8 }}>How did you pay?</legend>
        <div className="seg big" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
          {METHODS.map(([v, l]) => <button key={v} type="button" aria-pressed={method === v} onClick={() => setMethod(v)}>{l}</button>)}
        </div>
        {method === 'project_card' ? <input aria-label="Card last 4 digits" className="input mono" inputMode="numeric" maxLength={4} placeholder="Card last 4 digits" value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 220 }} /> : null}
        {method === 'own_money' ? <span className="small muted">Once approved, it’s added to your reimbursement.</span> : null}
      </fieldset>
      <div className="field"><label htmlFor="no">Note for the approver <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label><textarea id="no" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {error ? <div role="alert" className="alert">{error}</div> : null}
      <div className="row">
        <Link href="/my" className="btn lg">Cancel</Link>
        <button type="button" className="btn dark lg block" disabled={!!missing || busy} onClick={submit}>{busy ? 'Sending…' : missing ?? `Submit ${currency} ${money(amount)}`}</button>
      </div>
    </div>
  );
}
