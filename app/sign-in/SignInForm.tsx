'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Mode = 'email' | 'phone';

export function SignInForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('email');
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const normalizedPhone = () => {
    const digits = contact.replace(/[^\d+]/g, '');
    return digits.startsWith('+') ? digits : '+' + digits;
  };

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } =
      mode === 'email'
        ? await supabase.auth.signInWithOtp({
            email: contact.trim(),
            options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/confirm` }
          })
        : await supabase.auth.signInWithOtp({ phone: normalizedPhone(), options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      setError(
        mode === 'phone' && /signups not allowed|not found/i.test(error.message)
          ? 'That number isn’t on any team yet. Ask your admin to add you.'
          : error.message
      );
      return;
    }
    setSent(true);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const token = code.replace(/\D/g, '');
    const { error } =
      mode === 'email'
        ? await supabase.auth.verifyOtp({ email: contact.trim(), token, type: 'email' })
        : await supabase.auth.verifyOtp({ phone: normalizedPhone(), token, type: 'sms' });
    if (error) {
      setBusy(false);
      setError('That code didn’t work. Check it, or send a new one.');
      return;
    }
    await supabase.rpc('record_sign_in', { p_source: mode === 'phone' ? 'App' : 'Web' });
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="sheet-body">
      {!sent ? (
        <form onSubmit={send} className="col" style={{ gap: 18 }}>
          <div className="seg big" style={{ ['--n' as string]: 2 }} role="group" aria-label="Sign in with">
            <button type="button" aria-pressed={mode === 'email'} onClick={() => { setMode('email'); setContact(''); }}>Email</button>
            <button type="button" aria-pressed={mode === 'phone'} onClick={() => { setMode('phone'); setContact(''); }}>Phone number</button>
          </div>
          <div className="field">
            <label htmlFor="contact">{mode === 'email' ? 'Work email' : 'Mobile number'}</label>
            <input
              id="contact"
              className="input"
              type={mode === 'email' ? 'email' : 'tel'}
              autoComplete={mode === 'email' ? 'email' : 'tel'}
              placeholder={mode === 'email' ? 'you@company.com' : '+971 50 123 4567'}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
          </div>
          {error ? <div role="alert" className="alert">{error}</div> : null}
          <button className="btn dark lg" disabled={busy || !contact.trim()}>{busy ? 'Sending…' : 'Send me a code'}</button>
          <span className="small muted" style={{ lineHeight: 1.45 }}>
            New here? Sign in with your email and you can set up a workspace for your company.
          </span>
        </form>
      ) : (
        <form onSubmit={verify} className="col" style={{ gap: 18 }}>
          <span className="ink2" style={{ lineHeight: 1.45 }}>
            We sent a code to <b>{contact}</b>. It expires in a few minutes.
          </span>
          <div className="field">
            <label htmlFor="code">6-digit code</label>
            <input
              id="code"
              className="input mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ fontSize: 24, letterSpacing: '0.3em', height: 56 }}
              autoFocus
              required
            />
          </div>
          {error ? <div role="alert" className="alert">{error}</div> : null}
          <button className="btn dark lg" disabled={busy || code.replace(/\D/g, '').length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
          <div className="row between">
            <button type="button" className="link s13" onClick={() => { setSent(false); setCode(''); setError(null); }}>Use a different {mode === 'email' ? 'email' : 'number'}</button>
            <button type="button" className="link s13" onClick={(e) => send(e as unknown as React.FormEvent)} disabled={busy}>Send a new code</button>
          </div>
        </form>
      )}
    </div>
  );
}
