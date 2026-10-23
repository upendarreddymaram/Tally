'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isAdminRole, requireMember } from '@/lib/session';

type Result = { error?: string; id?: string };
type File = { path: string; name: string; size: number };

const refresh = () => revalidatePath('/', 'layout');

/** Anyone in the workspace (admins included) can record an expense. Counts against the budget straight away. */
export async function addExpense(p: { project_id: string; title: string; amount: number; note: string; file: File | null }): Promise<Result> {
  const { user, profile } = await requireMember();
  if (!p.title.trim()) return { error: 'Say what the expense was for.' };
  if (!(p.amount > 0)) return { error: 'Enter an amount.' };
  if (!p.file) return { error: 'Add a receipt or other proof.' };

  const db = createAdminClient();
  const { data: project } = await db.from('projects').select('id, name').eq('id', p.project_id).eq('company_id', profile.company_id).maybeSingle();
  if (!project) return { error: 'Pick a project.' };

  const now = new Date().toISOString();
  const { data: exp, error } = await db
    .from('expenses')
    .insert({
      company_id: profile.company_id, project_id: project.id, submitted_by: user.id, title: p.title.trim(), amount: p.amount,
      paid_at: now, pay_method: 'cash_float', note: p.note.trim() || null,
      status: 'approved', approved_amount: p.amount, decided_by: user.id, decided_at: now, auto_approved: true
    })
    .select('id, ref')
    .single();
  if (error || !exp) return { error: error?.message ?? 'Could not save.' };

  await db.from('expense_files').insert({ expense_id: exp.id, company_id: profile.company_id, path: p.file.path, name: p.file.name, size: p.file.size });
  await db.from('audit_log').insert({
    company_id: profile.company_id, actor_id: user.id, kind: 'money', ref: exp.ref, source: 'Web',
    text: `Added expense ${p.title.trim()} · ${p.amount} on ${project.name}`
  });
  refresh();
  return { id: project.id };
}

export async function addFunds(p: {
  project_id: string; amount: number; method: string; reference: string; note: string; file: File | null;
}): Promise<Result> {
  const { supabase, profile } = await requireMember();
  if (!isAdminRole(profile.role)) return { error: 'Only admins can add funds.' };
  if (!p.file) return { error: 'Add proof of the funds.' };
  const { error } = await supabase.rpc('add_funds', {
    p_project: p.project_id, p_amount: p.amount, p_method: p.method, p_reference: p.reference.trim() || null,
    p_received: null, p_proof_path: p.file.path, p_proof_name: p.file.name, p_note: p.note.trim() || null
  });
  if (error) return { error: error.message };
  refresh();
  return { id: p.project_id };
}

export async function createProject(p: { name: string; amount: number; file: File | null }): Promise<Result> {
  const { supabase, profile } = await requireMember();
  if (!isAdminRole(profile.role)) return { error: 'Only admins can create projects.' };
  if (!p.name.trim()) return { error: 'Give the project a name.' };
  if (!(p.amount > 0)) return { error: 'Enter the budget.' };
  if (!p.file) return { error: 'Add proof of the budget (transfer slip, approval, etc.).' };

  const db = createAdminClient();
  const { data: people } = await db.from('profiles').select('id').eq('company_id', profile.company_id).eq('active', true);
  const letters = p.name.trim().split(/\s+/).map((w) => w[0]).join('').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 4) || 'PRJ';
  const code = `${letters}-${Math.floor(100 + Math.random() * 900)}`;

  const { data, error } = await supabase.rpc('create_project', {
    p_name: p.name.trim(), p_code: code, p_starts: null, p_ends: null, p_lead: null,
    p_amount: p.amount, p_method: 'bank_transfer', p_reference: null, p_proof_path: p.file.path, p_proof_name: p.file.name,
    p_members: (people ?? []).map((x) => ({ user_id: x.id })),
    p_receipt_above: null, p_auto_up_to: null, p_admin_above: null, p_alert_pct: null, p_workers_see: true
  });
  if (error) return { error: error.message };
  refresh();
  return { id: data as string };
}
