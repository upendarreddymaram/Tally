import type { Metadata } from 'next';
import { BrandMark } from '@/components/Icon';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Ask for a new code below.',
  inactive: 'Your access to this workspace has been turned off. Ask an admin to turn it back on.'
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="sheet-wrap" style={{ alignItems: 'center' }}>
      <div className="sheet" style={{ width: 460 }}>
        <div className="sheet-head" style={{ flexDirection: 'column', gap: 18 }}>
          <div className="brand" style={{ padding: 0 }}>
            <BrandMark />
            <span className="brand-name">Tally</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <h1 className="h1 sm">Sign in</h1>
            <span className="muted" style={{ lineHeight: 1.45 }}>
              No password. We send a 6-digit code to your email, or by SMS if you were added with a phone number.
            </span>
          </div>
        </div>
        <SignInForm initialError={error ? ERRORS[error] ?? null : null} />
      </div>
    </div>
  );
}
