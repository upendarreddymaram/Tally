'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({ children, pendingText = 'Saving…', className = 'btn dark', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...rest} className={className} disabled={pending || rest.disabled}>
      {pending ? pendingText : children}
    </button>
  );
}

export function Result({ state }: { state: { error?: string; ok?: string } | null }) {
  if (!state) return null;
  if (state.error) return <div role="alert" className="alert">{state.error}</div>;
  if (state.ok) return <div role="status" className="ok-banner">{state.ok}</div>;
  return null;
}
