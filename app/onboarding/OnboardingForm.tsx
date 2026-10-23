'use client';

import { useActionState } from 'react';
import { createWorkspace } from './actions';

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createWorkspace, null);
  return (
    <form action={action} className="form">
      <div className="field">
        <label htmlFor="full_name">Your name</label>
        <input id="full_name" name="full_name" className="input" autoComplete="name" required />
      </div>
      <div className="field">
        <label htmlFor="company">Company name</label>
        <input id="company" name="company" className="input" autoComplete="organization" required />
      </div>
      {state?.error ? <div role="alert" className="alert">{state.error}</div> : null}
      <button className="btn primary lg" disabled={pending}>{pending ? 'Creating…' : 'Create workspace'}</button>
    </form>
  );
}
