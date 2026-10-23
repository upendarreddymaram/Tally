'use client';

import { useRef, useState } from 'react';
import { ACCEPT, MAX_FILE_MB, kb, uploadProof, type Uploaded } from './upload';
import { Icon } from '../Icon';

/** Single required proof file (funding slips, cheques, cash receipts). */
export function ProofPicker({
  companyId, folder, value, onChange, hint = 'Drop the transfer slip, cheque photo or signed cash receipt'
}: { companyId: string; folder: string; value: Uploaded | null; onChange: (u: Uploaded | null) => void; hint?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      onChange(await uploadProof(companyId, folder, file));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="col" style={{ gap: 8 }}>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="file-card">
          <span className="doc-thumb"><span /><span /><span /><span /></span>
          <span className="col grow" style={{ gap: 4 }}>
            <span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{value.name}</span>
            <span className="small muted">{kb(value.size)} · uploaded just now</span>
          </span>
          <button type="button" className="btn md" onClick={() => input.current?.click()}>Replace</button>
          <button type="button" className="icon-btn ghost" aria-label="Remove file" onClick={() => onChange(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <span className="ink2" style={{ lineHeight: 1.45 }}>
            {hint}
            <br />
            PDF, JPG or PNG · up to {MAX_FILE_MB} MB
          </span>
          <button type="button" className="btn dark" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : 'Choose file'}
          </button>
        </div>
      )}
      {err ? <div role="alert" className="alert">{err}</div> : null}
    </div>
  );
}
