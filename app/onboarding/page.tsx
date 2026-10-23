import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { BrandMark } from '@/components/Icon';
import { getSession } from '@/lib/session';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = { title: 'Set up your workspace' };

export default async function OnboardingPage() {
  const { user, profile } = await getSession();
  if (!user) redirect('/sign-in');
  if (profile) redirect('/');
  return (
    <div className="sheet-wrap" style={{ alignItems: 'center' }}>
      <div className="sheet" style={{ width: 520 }}>
        <div className="sheet-head" style={{ flexDirection: 'column', gap: 18 }}>
          <div className="brand" style={{ padding: 0 }}>
            <BrandMark />
            <span className="brand-name">Tally</span>
          </div>
          <div className="col" style={{ gap: 6 }}>
            <span className="eyebrow">Signed in as {user.email ?? user.phone}</span>
            <h1 className="h1 sm">Set up your workspace</h1>
            <span className="muted" style={{ lineHeight: 1.45 }}>
              You’ll be the owner. If your company already uses Tally, don’t create a new one — ask an admin to add you, then sign in again.
            </span>
          </div>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
