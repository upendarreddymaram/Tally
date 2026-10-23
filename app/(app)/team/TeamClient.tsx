'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addTeamMember, updateTeamMember } from '@/lib/actions';
import { Result, SubmitButton } from '@/components/ui/FormStatus';
import { Icon } from '@/components/Icon';
import { whole } from '@/lib/format';
import type { Profile } from '@/lib/types';

export function AddMemberForm({ projects, defaultLimit, canMakeOwner }: { projects: { id: string; name: string }[]; defaultLimit: number; canMakeOwner: boolean }) {
  const [state, action] = useActionState(addTeamMember, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="col" style={{ gap: 12 }}>
      <div className="field"><label htmlFor="fn">Full name</label><input id="fn" name="full_name" className="input" required /></div>
      <div className="field"><label htmlFor="em">Email <span className="muted" style={{ fontWeight: 400 }}>(admins &amp; approvers)</span></label><input id="em" name="email" type="email" className="input" /></div>
      <div className="field"><label htmlFor="ph">Mobile <span className="muted" style={{ fontWeight: 400 }}>(workers, with country code)</span></label><input id="ph" name="phone" type="tel" className="input" placeholder="+971 50 123 4567" /></div>
      <div className="field">
        <label htmlFor="rl">Role</label>
        <select id="rl" name="role" className="input" defaultValue="worker">
          <option value="worker">Worker — submits claims</option>
          <option value="approver">Approver — decides claims</option>
          <option value="admin">Admin — manages money and people</option>
          {canMakeOwner ? <option value="owner">Owner — full access</option> : null}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pj">Add to project <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
        <select id="pj" name="project_id" className="input" defaultValue="">
          <option value="">Not yet</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="row between"><label htmlFor="lm" className="label">Monthly limit</label><input id="lm" name="monthly_limit" className="input num" defaultValue={whole(defaultLimit)} /></div>
      <Result state={state} />
      <SubmitButton className="btn dark lg" pendingText="Adding…">Add to team</SubmitButton>
    </form>
  );
}

export function EditMember({ person, isOwner, self }: { person: Profile; isOwner: boolean; self: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(updateTeamMember, null);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);
  return (
    <>
      <button type="button" aria-label={`Edit ${person.full_name}`} className="icon-btn ghost" onClick={() => setOpen(true)}><Icon name="edit" size={15} stroke="#3B3B41" /></button>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label={`Edit ${person.full_name}`} style={{ position: 'fixed', inset: 0, background: 'rgba(17,17,19,.35)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
          <form action={action} className="card pad-lg col" style={{ width: 440, maxWidth: '100%', gap: 14 }}>
            <input type="hidden" name="id" value={person.id} />
            <div className="row between"><h2 className="h2">Edit person</h2><button type="button" className="icon-btn ghost" aria-label="Close" onClick={() => setOpen(false)}><Icon name="close" size={16} /></button></div>
            <div className="field"><label htmlFor={`n-${person.id}`}>Full name</label><input id={`n-${person.id}`} name="full_name" className="input" defaultValue={person.full_name} required /></div>
            <div className="field">
              <label htmlFor={`r-${person.id}`}>Role</label>
              <select id={`r-${person.id}`} name="role" className="input" defaultValue={person.role} disabled={self}>
                <option value="worker">Worker</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
                {isOwner || person.role === 'owner' ? <option value="owner">Owner</option> : null}
              </select>
              {self ? <input type="hidden" name="role" value={person.role} /> : null}
            </div>
            <div className="field"><label htmlFor={`b-${person.id}`}>Bank details for reimbursements</label><input id={`b-${person.id}`} name="bank_details" className="input mono" defaultValue={person.bank_details ?? ''} placeholder="e.g. •• 3310 Emirates NBD" /></div>
            <label className="row"><input type="checkbox" name="active" className="check" defaultChecked={person.active} disabled={self} />Can sign in</label>
            {self ? <input type="hidden" name="active" value="on" /> : null}
            <Result state={state} />
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
              <SubmitButton>Save</SubmitButton>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
