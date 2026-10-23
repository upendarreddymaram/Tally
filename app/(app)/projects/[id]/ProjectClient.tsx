'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addProjectMember, removeProjectMember, setProjectStatus, updateMemberLimit, updateProjectRules } from '@/lib/actions';
import { Result, SubmitButton } from '@/components/ui/FormStatus';
import { Icon } from '@/components/Icon';
import { parseAmount, whole } from '@/lib/format';

export function ProjectMenu({ id, status }: { id: string; status: 'active' | 'completed' }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" aria-label="More project actions" aria-expanded={open} className="icon-btn" style={{ width: 44, height: 44, borderRadius: 10 }} onClick={() => setOpen(!open)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#111113" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open ? (
        <div className="card" style={{ position: 'absolute', right: 0, top: 50, zIndex: 20, padding: 6, minWidth: 220, boxShadow: '0 12px 30px rgba(0,0,0,.12)' }}>
          <a href={`/api/export/ledger?project=${id}`} className="btn sm" style={{ border: 0, width: '100%', justifyContent: 'flex-start' }}>Export ledger CSV</a>
          <button
            type="button"
            className="btn sm"
            disabled={pending}
            style={{ border: 0, width: '100%', justifyContent: 'flex-start', background: 'transparent', color: 'var(--ink)' }}
            onClick={() =>
              start(async () => {
                if (status === 'active' && !confirm('Mark this project as completed? Workers will no longer be able to submit claims to it.')) return;
                await setProjectStatus(id, status === 'active' ? 'completed' : 'active');
                setOpen(false);
                router.refresh();
              })
            }
          >
            {status === 'active' ? 'Mark as completed' : 'Reopen project'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function MemberLimit({ projectId, userId, name, limit }: { projectId: string; userId: string; name: string; limit: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(whole(limit));
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!editing)
    return (
      <button type="button" aria-label={`Edit limit for ${name}`} className="icon-btn ghost" style={{ width: 36, height: 36 }} onClick={() => setEditing(true)}>
        <Icon name="edit" size={15} stroke="#3B3B41" />
      </button>
    );
  return (
    <span className="row" style={{ gap: 4 }}>
      <input aria-label={`Monthly limit for ${name}`} className="input num" style={{ width: 84, height: 34 }} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      <button type="button" className="icon-btn" style={{ width: 34, height: 34 }} aria-label="Save" disabled={pending}
        onClick={() => start(async () => { await updateMemberLimit(projectId, userId, parseAmount(value)); setEditing(false); router.refresh(); })}>
        <Icon name="check" size={14} width={2.6} />
      </button>
      <button type="button" className="icon-btn ghost" style={{ width: 34, height: 34 }} aria-label={`Remove ${name} from project`} disabled={pending}
        onClick={() => start(async () => { if (confirm(`Remove ${name} from this project?`)) { await removeProjectMember(projectId, userId); router.refresh(); } })}>
        <Icon name="close" size={14} />
      </button>
    </span>
  );
}

export function AddMemberForm({ projectId, people, defaultLimit }: { projectId: string; people: { id: string; full_name: string }[]; defaultLimit: number }) {
  const [state, action] = useActionState(addProjectMember, null);
  const [open, setOpen] = useState(false);
  if (!people.length) return null;
  if (!open) return <button type="button" className="btn md" style={{ alignSelf: 'flex-start', marginTop: 8 }} onClick={() => setOpen(true)}>+ Add someone</button>;
  return (
    <form action={action} className="col" style={{ gap: 8, paddingTop: 12, borderTop: '1px solid var(--line-3)' }}>
      <input type="hidden" name="project_id" value={projectId} />
      <select name="user_id" className="input sm" aria-label="Person">{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
      <div className="row">
        <label className="small muted" htmlFor="ml">Monthly limit</label>
        <input id="ml" name="monthly_limit" className="input num" defaultValue={whole(defaultLimit)} />
        <SubmitButton className="btn dark md">Add</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function RulesForm({
  projectId, currency, values, defaults
}: {
  projectId: string; currency: string;
  values: { receipt_required_above: number | null; auto_approve_up_to: number | null; admin_approval_above: number | null; alert_below_pct: number | null; workers_see_balance: boolean };
  defaults: { receipt_required_above: number; auto_approve_up_to: number; admin_approval_above: number; alert_below_pct: number };
}) {
  const [state, action] = useActionState(updateProjectRules, null);
  const rows = [
    ['receipt_required_above', 'Receipt required above', currency],
    ['auto_approve_up_to', 'Auto-approve with receipt attached, up to', currency],
    ['admin_approval_above', 'Admin approval above', currency],
    ['alert_below_pct', 'Alert when budget left falls below', '%']
  ] as const;
  return (
    <form action={action} className="col" style={{ gap: 0 }}>
      <input type="hidden" name="project_id" value={projectId} />
      <span className="small muted" style={{ marginBottom: 8 }}>Leave a box empty to use the company default (shown in grey).</span>
      {rows.map(([k, label, unit]) => (
        <div key={k} className="setting-row">
          <span><label htmlFor={k} style={{ fontWeight: 600 }}>{label}</label></span>
          <span className="row" style={{ gap: 6 }}>
            <span className="small muted">{unit}</span>
            <input id={k} name={k} className="input num" defaultValue={values[k] === null ? '' : whole(values[k])} placeholder={whole(defaults[k])} />
          </span>
        </div>
      ))}
      <label className="setting-row" style={{ justifyContent: 'flex-start' }}>
        <input type="checkbox" name="workers_see_balance" className="check" defaultChecked={values.workers_see_balance} />
        <span style={{ flex: 'none' }}>Workers can see the project balance</span>
      </label>
      <div className="row" style={{ justifyContent: 'flex-end', paddingTop: 12 }}>
        <Result state={state} />
        <SubmitButton>Save rules</SubmitButton>
      </div>
    </form>
  );
}
