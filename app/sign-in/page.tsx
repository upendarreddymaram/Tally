import type { Metadata } from 'next';
import { BrandMark } from '@/components/Brand';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

const ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired. Please sign in again.',
  inactive: 'Your access has been turned off. Ask an admin to turn it back on.'
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="center">
      <div className="card auth">
        <div className="brand big"><BrandMark size={40} /><span>Tally</span></div>
        <h1>Welcome back</h1>
        <p className="muted">Sign in to track project budgets and expenses.</p>
        <SignInForm initialError={error ? ERRORS[error] ?? null : null} />
      </div>
    </div>
  );
}
