'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCategory, renameCategory, saveSettings } from '@/lib/actions';
import { Result, SubmitButton } from '@/components/ui/FormStatus';
import { Icon } from '@/components/Icon';
import { whole } from '@/lib/format';
import type { Company } from '@/lib/types';

const FORM = 'settings-form';

function Row({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="setting-row">
      <span>
        <span style={{ fontWeight: 600 }}>{title}</span>
        {hint ? <span className="small muted">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

function Choice({ name, value, options }: { name: string; value: string; options: string[] }) {
  const opts = options.includes(value) ? options : [value, ...options];
  return (
    <select name={name} form={FORM} aria-label={name} defaultValue={value} className="input sm" style={{ width: 'auto' }}>
      {opts.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

function Amount({ name, value, unit = 'AED', after }: { name: string; value: number; unit?: string; after?: boolean }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      {!after ? <span className="small muted">{unit}</span> : null}
      <input name={name} form={FORM} aria-label={name} defaultValue={whole(value)} className="input num" style={after ? { width: 70 } : undefined} />
      {after ? <span className="small muted">{unit}</span> : null}
    </span>
  );
}

function Switch({ name, value }: { name: string; value: boolean }) {
  const [on, setOn] = useState(value);
  return (
    <>
      <input type="hidden" name={name} form={FORM} value={String(on)} />
      <button type="button" role="switch" aria-checked={on} aria-label={name} className="switch" onClick={() => setOn(!on)}><span /></button>
    </>
  );
}

export function SettingsForm({ company: c, children }: { company: Company; children: React.ReactNode }) {
  const [state, action] = useActionState(saveSettings, null);
  const cur = c.currency;
  return (
    <>
      <form id={FORM} action={action} />
      <section id="company" aria-label="Company" className="card pad-lg">
        <h2 className="h2" style={{ marginBottom: 6 }}>Company</h2>
        <Row title="Company name"><input name="name" form={FORM} aria-label="Company name" defaultValue={c.name} className="input sm" style={{ width: 280 }} /></Row>
        <Row title="Currency" hint="Shown on every amount. Changing it does not convert past entries.">
          <Choice name="currency" value={c.currency} options={['AED', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD', 'USD', 'EUR', 'GBP', 'INR']} />
        </Row>
        <Row title="Financial year starts"><Choice name="fy_start" value={c.fy_start} options={['1 January', '1 April', '1 July', '1 October']} /></Row>
        <Row title="Time zone"><Choice name="timezone" value={c.timezone} options={['Asia/Dubai', 'Asia/Riyadh', 'Asia/Qatar', 'Asia/Kolkata', 'Europe/London', 'UTC']} /></Row>
      </section>

      <section id="rules" aria-label="Default spending rules" className="card pad-lg">
        <h2 className="h2" style={{ marginBottom: 6 }}>Default spending rules</h2>
        <Row title="Receipt or screenshot required above" hint="Below this, proof is optional but speeds up approval."><Amount name="receipt_required_above" value={c.receipt_required_above} unit={cur} /></Row>
        <Row title="Auto-approve with a receipt attached up to" hint="Only when nothing is flagged (no duplicate, within limits). Set 0 to turn off."><Amount name="auto_approve_up_to" value={c.auto_approve_up_to} unit={cur} /></Row>
        <Row title="Admin approval required above"><Amount name="admin_approval_above" value={c.admin_approval_above} unit={cur} /></Row>
        <Row title="Default monthly limit per worker"><Amount name="default_monthly_limit" value={c.default_monthly_limit} unit={cur} /></Row>
        <Row title="Second admin sign-off for budget decreases over" hint="Also applies to moving money between projects."><Amount name="signoff_above" value={c.signoff_above} unit={cur} /></Row>
        <Row title="Alert when a project drops below"><Amount name="alert_below_pct" value={c.alert_below_pct} unit="% left" after /></Row>
        <Row title="Flag possible duplicates" hint="Same amount and supplier within 30 days."><Switch name="flag_duplicates" value={c.flag_duplicates} /></Row>
      </section>

      {children}

      <section id="notify" aria-label="Notifications" className="card pad-lg">
        <h2 className="h2" style={{ marginBottom: 6 }}>Notifications</h2>
        <Row title="New claim waiting for approval"><Choice name="notify_new_claim" value={c.notify_new_claim} options={['Push + daily email digest', 'Push only', 'Email only', 'Off']} /></Row>
        <Row title="Project below alert level"><Choice name="notify_low_balance" value={c.notify_low_balance} options={['Push + email immediately', 'Email only', 'Off']} /></Row>
        <Row title="Budget change waiting for sign-off"><Choice name="notify_signoff" value={c.notify_signoff} options={['Push + email immediately', 'Email only', 'Off']} /></Row>
        <Row title="Weekly spend report"><Choice name="notify_weekly" value={c.notify_weekly} options={['Monday 8:00 by email', 'Off']} /></Row>
      </section>

      <section id="security" aria-label="Security" className="card pad-lg">
        <h2 className="h2" style={{ marginBottom: 6 }}>Security</h2>
        <Row title="Sign in with a one-time code" hint="Always on. No passwords — a 6-digit code by email (or SMS for phone logins) every time."><span className="pill lg">Always on</span></Row>
        <Row title="Workers sign in by phone number" hint="One-time SMS code, no password to forget. Needs an SMS provider in Supabase."><Switch name="workers_phone_signin" value={c.workers_phone_signin} /></Row>
        <Row title="Sign everyone out after"><Choice name="session_timeout" value={c.session_timeout} options={['30 days of inactivity', '7 days', '24 hours']} /></Row>
        <Row title="Allow workers to see the project balance"><Switch name="workers_see_balance" value={c.workers_see_balance} /></Row>
        <div className="row" style={{ paddingTop: 16, borderTop: '1px solid var(--line-3)', justifyContent: 'flex-end' }}>
          <Result state={state} />
          <button type="reset" form={FORM} className="btn" onClick={() => window.location.reload()}>Discard</button>
          <SubmitButton form={FORM}>Save changes</SubmitButton>
        </div>
      </section>
    </>
  );
}

export function Categories({ cats }: { cats: { id: string; name: string; n: number }[] }) {
  const [state, action] = useActionState(addCategory, null);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <section id="categories" aria-label="Categories" className="card pad-lg col" style={{ gap: 12 }}>
      <div className="row between">
        <h2 className="h2">Expense categories</h2>
        {!adding ? <button type="button" className="btn md" onClick={() => setAdding(true)}>+ Add category</button> : null}
      </div>
      {adding ? (
        <form action={action} className="row">
          <input name="name" className="input sm" placeholder="e.g. Equipment hire" autoFocus style={{ width: 240 }} />
          <SubmitButton className="btn dark md">Add</SubmitButton>
          <button type="button" className="btn md" onClick={() => setAdding(false)}>Done</button>
        </form>
      ) : null}
      <Result state={state} />
      <div className="row wrap" style={{ gap: 8 }}>
        {cats.map((c) =>
          editing === c.id ? (
            <span key={c.id} className="row" style={{ gap: 4 }}>
              <input className="input sm" value={value} onChange={(e) => setValue(e.target.value)} autoFocus style={{ width: 160 }} />
              <button type="button" className="icon-btn" aria-label="Save" disabled={pending}
                onClick={() => start(async () => { await renameCategory(c.id, value.trim()); setEditing(null); router.refresh(); })}>
                <Icon name="check" size={14} width={2.6} />
              </button>
            </span>
          ) : (
            <span key={c.id} className="row" style={{ gap: 8, height: 40, padding: '0 6px 0 14px', border: '1px solid var(--line)', borderRadius: 999, background: '#fff', fontWeight: 500 }}>
              {c.name}
              <span className="muted" style={{ fontSize: 11 }}>{c.n}</span>
              <button type="button" aria-label={`Edit ${c.name}`} onClick={() => { setEditing(c.id); setValue(c.name); }} style={{ width: 28, height: 28, border: 0, background: 'var(--panel-2)', borderRadius: 999, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="edit" size={12} stroke="#3B3B41" width={2.2} />
              </button>
            </span>
          )
        )}
      </div>
    </section>
  );
}
