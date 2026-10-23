'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { decideExpense, quickApprove } from '@/lib/actions';
import { Result } from '@/components/ui/FormStatus';
import { money, parseAmount } from '@/lib/format';

type Mode = 'approve' | 'partial' | 'info' | 'reject';
const LABELS: Record<Mode, string> = { approve: 'Approve full', partial: 'Approve part', info: 'Ask for info', reject: 'Reject' };
const PART_REASONS = ['Above the agreed quote', 'Part of it is personal', 'Item not covered by the project', 'Other — explain in note'];

export function DecisionPanel({ id, amount, first, currency, next }: { id: string; amount: number; first: string; currency: string; next: string }) {
  const [state, action, pending] = useActionState(decideExpense, null);
  const [mode, setMode] = useState<Mode>('approve');
  const [partial, setPartial] = useState(money(Math.floor(amount * 0.9)));
  const [note, setNote] = useState('');

  const part = parseAmount(partial);
  const needsNote = mode === 'info' || mode === 'reject';
  const invalid = (needsNote && !note.trim()) || (mode === 'partial' && (part <= 0 || part >= amount));
  const actionLabel = {
    approve: `Approve ${currency} ${money(amount)}`,
    partial: `Approve ${currency} ${money(part)}`,
    info: `Send question to ${first}`,
    reject: 'Reject claim'
  }[mode];

  return (
    <form action={action} className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }} aria-label="Decision">
      <input type="hidden" name="expense_id" value={id} />
      <input type="hidden" name="decision" value={mode} />
      <input type="hidden" name="next" value={next} />
      <div role="group" aria-label="Decision" className="seg big" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
        {(Object.keys(LABELS) as Mode[]).map((k) => (
          <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} style={mode === k && k === 'reject' ? { color: 'var(--signal-dark)' } : undefined}>{LABELS[k]}</button>
        ))}
      </div>
      {mode === 'partial' ? (
        <>
          <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
            <div className="field">
              <label htmlFor="part">Approve this much</label>
              <div className="row" style={{ gap: 8, height: 48, padding: '0 12px', border: '2px solid var(--ink)', borderRadius: 10, background: '#fff' }}>
                <span className="mono muted">{currency}</span>
                <input id="part" name="amount" value={partial} onChange={(e) => setPartial(e.target.value)} inputMode="decimal" className="mono" style={{ width: 120, border: 0, outline: 'none', fontSize: 18, fontWeight: 600 }} />
              </div>
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="why">Reason (shown to {first})</label>
              <select id="why" name="reason" className="input" style={{ height: 48 }}>{PART_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
            </div>
          </div>
          <span className="s13 ink2">{first} will see <b>Part-approved {money(part)} of {money(amount)}</b>. The rest goes back to the budget.</span>
        </>
      ) : null}
      {mode !== 'approve' ? (
        <div className="field">
          <label htmlFor="msg">{mode === 'reject' ? 'Why are you rejecting? (required)' : mode === 'info' ? `What do you need from ${first}?` : 'Note (optional)'}</label>
          <textarea
            id="msg" name="note" rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={mode === 'info' ? 'e.g. Please upload the delivery note as well.' : mode === 'reject' ? 'e.g. Personal purchase — not a project cost.' : ''}
          />
        </div>
      ) : null}
      <Result state={state} />
      <div className="row wrap between">
        <span className="small muted" style={{ maxWidth: 380, lineHeight: 1.45 }}>Every decision and edit is saved in the audit log with your name and time, and shown to the worker.</span>
        <button className="btn" disabled={pending || invalid} style={{ height: 48, padding: '0 22px', border: 0, fontWeight: 700, color: '#fff', background: mode === 'reject' ? 'var(--signal-dark)' : 'var(--ink)' }}>
          {pending ? 'Saving…' : actionLabel}
        </button>
      </div>
    </form>
  );
}

export function KeyboardNav({ ids, current, filter }: { ids: string[]; current?: string; filter: string }) {
  const router = useRouter();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable) return;
      const i = current ? ids.indexOf(current) : -1;
      const go = (id?: string) => id && router.push(`/approvals?filter=${filter}&id=${id}`);
      const key = e.key.toLowerCase();
      if (key === 'j') go(ids[Math.min(ids.length - 1, i + 1)]);
      else if (key === 'k') go(ids[Math.max(0, i - 1)]);
      else if (key === 'a' && current && i >= 0) {
        quickApprove(current).then(() => {
          go(ids[i + 1] ?? ids[i - 1]);
          router.refresh();
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ids, current, filter, router]);
  return null;
}
