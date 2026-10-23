'use client';

import { useActionState, useState } from 'react';
import { decideBudgetChange } from '@/lib/actions';
import { Result } from '@/components/ui/FormStatus';

export function SignOffForm({ id, who, label }: { id: string; who: string; label: string }) {
  const [state, action, pending] = useActionState(decideBudgetChange, null);
  const [note, setNote] = useState('');
  return (
    <form action={action} className="col" style={{ gap: 14 }}>
      <input type="hidden" name="change_id" value={id} />
      <div className="field">
        <label htmlFor={`n-${id}`}>Note to {who} <span className="muted" style={{ fontWeight: 400 }}>(required to decline)</span></label>
        <textarea id={`n-${id}`} name="note" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Result state={state} />
      <div className="row">
        <button name="decision" value="decline" className="btn danger" style={{ height: 48 }} disabled={pending || !note.trim()}>Decline</button>
        <button name="decision" value="approve" className="btn dark block" style={{ height: 48 }} disabled={pending}>{pending ? 'Saving…' : label}</button>
      </div>
    </form>
  );
}
