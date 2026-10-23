import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/Brand';
import { getSession } from '@/lib/session';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: 'Set up your workspace' };

export default async function OnboardingPage() {
  const { user, profile } = await getSession();
  if (!user) redirect('/sign-in');
  if (profile) redirect('/');
  return (
    <div className="center">
      <div className="card auth">
        <div className="brand big"><BrandMark size={40} /><span>Tally</span></div>
        <h1>Set up your workspace</h1>
        <p className="muted">Signed in as {user.email ?? user.phone}. You’ll be the owner.</p>
        <OnboardingForm />
      </div>
    </div>
  );
}
