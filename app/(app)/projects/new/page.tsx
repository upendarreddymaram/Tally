import type { Metadata } from 'next';
import Link from 'next/link';
import { isAdminRole, requireMember } from '@/lib/session';
import { redirect } from 'next/navigation';
import { NewProjectForm } from './NewProjectForm';

export const metadata: Metadata = { title: 'New project' };

export default async function NewProjectPage() {
  const { profile, company } = await requireMember();
  if (!isAdminRole(profile.role)) redirect('/projects');
  return (
    <div className="narrow">
      <Link href="/projects" className="back">← Projects</Link>
      <h1>New project</h1>
      <p className="muted">Name it, set the starting budget and attach proof of the money.</p>
      <NewProjectForm companyId={company.id} currency={company.currency} />
    </div>
  );
}
