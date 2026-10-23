'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveClean, quickApprove } from '@/lib/actions';
import { Icon } from '../Icon';

export function QuickApprove({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={`Approve ${label}`}
      title={err ?? `Approve ${label}`}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await quickApprove(id);
          if (r.error) setErr(r.error);
          router.refresh();
        })
      }
      style={err ? { borderColor: 'var(--signal-dark)' } : undefined}
    >
      <Icon name="check" size={16} width={2.6} />
    </button>
  );
}

export function ApproveCleanButton({ label }: { label: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="row">
      {msg ? <span className="s13">{msg}</span> : null}
      <button
        type="button"
        className="btn dark"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await approveClean();
            setMsg(r.error ?? r.ok ?? null);
            router.refresh();
          })
        }
      >
        {pending ? 'Approving…' : label}
      </button>
    </span>
  );
}
