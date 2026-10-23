import { redirect } from 'next/navigation';
import { canApproveRole, requireMember } from '@/lib/session';

export default async function Home() {
  const { profile } = await requireMember();
  redirect(canApproveRole(profile.role) ? '/overview' : '/my');
}
