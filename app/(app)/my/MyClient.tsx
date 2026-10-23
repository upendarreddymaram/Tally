'use client';

import { useActionState, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { replyExpense, updateMyBankDetails } from '@/lib/actions';
import { Result, SubmitButton } from '@/components/ui/FormStatus';
import { ACCEPT, uploadProof } from '@/components/ui/upload';

export function ReplyForm({ expenseId, companyId }: { expenseId: string; companyId: string }) {
  const router = useRouter();
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function send() {
    setBusy(true);
    setErr(null);
    try {
      const uploaded = await Promise.all(files.map((f) => uploadProof(companyId, 'expenses', f)));
      const r = await replyExpense({ expense_id: expenseId, note, files: uploaded });
      if (r.error) throw new Error(r.error);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <textarea className="input" rows={2} placeholder="Your answer" value={note} onChange={(e) => setNote(e.target.value)} />
      <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])])} />
      <div className="row wrap">
        <button type="button" className="btn md" onClick={() => input.current?.click()}>{files.length ? `${files.length} file(s) added` : 'Add photo or file'}</button>
        <button type="button" className="btn dark md" disabled={busy || (!note.trim() && !files.length)} onClick={send}>{busy ? 'Sending…' : 'Send reply'}</button>
      </div>
      {err ? <div role="alert" className="alert">{err}</div> : null}
    </div>
  );
}

export function BankDetails({ value }: { value: string | null }) {
  const [state, action] = useActionState(updateMyBankDetails, null);
  return (
    <form action={action} className="card pad col" style={{ gap: 10 }}>
      <h2 className="h2">Where to pay you back</h2>
      <span className="small muted">Used when you claim money you paid yourself. Only admins see this.</span>
      <div className="row wrap">
        <input name="bank_details" className="input mono" defaultValue={value ?? ''} placeholder="Bank name and account / IBAN" style={{ flex: '1 1 260px', width: 'auto' }} />
        <SubmitButton className="btn md">Save</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}
