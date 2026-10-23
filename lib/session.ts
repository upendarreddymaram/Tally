import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Company, Profile } from '@/lib/types';

export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null, company: null } as const;
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle<Profile>();
  const { data: company } = profile
    ? await supabase.from('companies').select('*').eq('id', profile.company_id).single<Company>()
    : { data: null };
  return { supabase, user, profile, company } as const;
});

/** Any signed-in member of a workspace. */
export async function requireMember() {
  const s = await getSession();
  if (!s.user) redirect('/sign-in');
  if (!s.profile) redirect('/onboarding');
  if (!s.profile.active || !s.company) redirect('/auth/sign-out?reason=inactive');
  return { supabase: s.supabase, user: s.user, profile: s.profile, company: s.company };
}

export const isAdminRole = (r: string) => r === 'owner' || r === 'admin';
export const canApproveRole = (r: string) => isAdminRole(r) || r === 'approver';

export async function requireApprover() {
  const s = await requireMember();
  if (!canApproveRole(s.profile.role)) redirect('/my');
  return s;
}

export async function requireAdmin() {
  const s = await requireMember();
  if (!isAdminRole(s.profile.role)) redirect(canApproveRole(s.profile.role) ? '/overview' : '/my');
  return s;
}
