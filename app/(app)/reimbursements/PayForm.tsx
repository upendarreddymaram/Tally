'use client';

import { useActionState, useState } from 'react';
import { payReimbursements } from '@/lib/actions';
import { Result, SubmitButton } from '@/components/ui/FormStatus';

export function PayForm({ person, label, dark }: { person?: string; label: string; dark?: boolean }) {
  const [state, action] = useActionState(payReimbursements, null);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <span className="row">
        {state?.ok ? <span className="s13">{state.ok}</span> : null}
        <button type="button" className={`btn ${dark ? 'dark' : 'md'}`} onClick={() => setOpen(true)}>{label}</button>
      </span>
    );
  return (
    <form action={(f) => { action(f); setOpen(false); }} className="row wrap" style={{ gap: 8 }}>
      {person ? <input type="hidden" name="person" value={person} /> : null}
      <input name="reference" className="input sm mono" placeholder="Transfer ref, e.g. FT26250" style={{ width: 210 }} aria-label="Transfer reference" />
      <SubmitButton className="btn dark md" pendingText="Paying…">Mark paid</SubmitButton>
      <button type="button" className="btn md" onClick={() => setOpen(false)}>Cancel</button>
      <Result state={state} />
    </form>
  );
}
