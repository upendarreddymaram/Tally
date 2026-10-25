'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function SignInForm({ initialError }: { initialError: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.includes('@') ? email.trim() : `${email.trim()}@tally.app`, password });
    if (error) {
      setBusy(false);
      setError('Wrong email or password.');
      return;
    }
    await supabase.rpc('record_sign_in', { p_source: 'Web' });
    router.replace('/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="form">
      <div className="field">
        <label htmlFor="email">Email or username</label>
        <input id="email" className="input" type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error ? <div role="alert" className="alert">{error}</div> : null}
      <button className="btn primary lg" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
