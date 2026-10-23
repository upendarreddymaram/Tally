'use client';

import { useRef, useState } from 'react';
import { ACCEPT, MAX_FILE_MB, kb, uploadProof, type Uploaded } from './upload';

/** One proof file (receipt, transfer slip, cheque photo…). Uploads to storage as soon as it's chosen. */
export function ProofPicker({
  companyId, folder, value, onChange, hint = 'Add a receipt, photo or PDF'
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
    <div className="stack" style={{ gap: 8 }}>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
      {value ? (
        <div className="file">
          <span className="file-icon">✓</span>
          <span className="grow">
            <b>{value.name}</b>
            <span className="muted small"> · {kb(value.size)}</span>
          </span>
          <button type="button" className="btn ghost sm" onClick={() => input.current?.click()}>Replace</button>
          <button type="button" className="btn ghost sm" onClick={() => onChange(null)}>Remove</button>
        </div>
      ) : (
        <button
          type="button"
          className="drop"
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
        >
          <b>{busy ? 'Uploading…' : hint}</b>
          <span className="muted small">Tap to choose or drop a file · PDF, JPG or PNG · up to {MAX_FILE_MB} MB</span>
        </button>
      )}
      {err ? <div role="alert" className="alert">{err}</div> : null}
    </div>
  );
}
