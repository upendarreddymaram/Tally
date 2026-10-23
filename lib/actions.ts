'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/session';
import { parseAmount } from '@/lib/format';

export type ActionResult = { error?: string; ok?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const optNum = (f: FormData, k: string) => (str(f, k) === '' ? null : parseAmount(str(f, k)));

function done(paths: string[] = ['/', '/overview']) {
  paths.forEach((p) => revalidatePath(p));
  revalidatePath('/', 'layout');
}

// ---------------------------------------------------------------- Expenses

export async function decideExpense(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const decision = str(form, 'decision');
  const { error } = await supabase.rpc('decide_expense', {
    p_expense: str(form, 'expense_id'),
    p_decision: decision,
    p_amount: decision === 'partial' ? parseAmount(str(form, 'amount')) : null,
    p_reason: str(form, 'reason') || null,
    p_note: str(form, 'note') || null
  });
  if (error) return { error: error.message };
  done(['/approvals', '/expenses', '/overview', '/reimbursements']);
  const next = str(form, 'next');
  if (next) redirect(next);
  return { ok: 'Saved' };
}

export async function quickApprove(expenseId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_expense', { p_expense: expenseId, p_decision: 'approve', p_amount: null, p_reason: null, p_note: null });
  if (error) return { error: error.message };
  done(['/approvals', '/expenses', '/overview']);
  return { ok: 'Approved' };
}

export async function approveClean() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('approve_clean_claims');
  if (error) return { error: error.message };
  done(['/approvals', '/expenses', '/overview']);
  return { ok: `Approved ${data} claims` };
}

export async function submitExpense(payload: {
  project_id: string; title: string; category_id: string | null; vendor: string; amount: number; paid_at: string;
  pay_method: string; card_last4: string; note: string; files: { path: string; name: string; size: number }[];
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_expense', {
    p_project: payload.project_id,
    p_title: payload.title,
    p_category: payload.category_id || null,
    p_vendor: payload.vendor,
    p_amount: payload.amount,
    p_paid_at: payload.paid_at ? new Date(payload.paid_at).toISOString() : null,
    p_method: payload.pay_method,
    p_card_last4: payload.card_last4,
    p_note: payload.note || null,
    p_files: payload.files
  });
  if (error) return { error: error.message };
  done(['/my', '/approvals', '/expenses', '/overview']);
  return { ok: data as string };
}

export async function replyExpense(payload: { expense_id: string; note: string; files: { path: string; name: string; size: number }[] }) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('reply_expense', { p_expense: payload.expense_id, p_note: payload.note, p_files: payload.files });
  if (error) return { error: error.message };
  done(['/my', '/approvals']);
  return { ok: 'Sent' };
}

// ---------------------------------------------------------------- Projects & money

export async function createProject(payload: {
  name: string; code: string; starts_on: string; ends_on: string; lead_id: string; amount: number; method: string;
  reference: string; proof_path: string; proof_name: string; members: { user_id: string; monthly_limit: number }[];
  rules: { receipt: number | null; auto: number | null; admin: number | null; alert: number | null; workersSee: boolean };
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_project', {
    p_name: payload.name,
    p_code: payload.code,
    p_starts: payload.starts_on || null,
    p_ends: payload.ends_on || null,
    p_lead: payload.lead_id || null,
    p_amount: payload.amount,
    p_method: payload.method,
    p_reference: payload.reference,
    p_proof_path: payload.proof_path,
    p_proof_name: payload.proof_name,
    p_members: payload.members,
    p_receipt_above: payload.rules.receipt,
    p_auto_up_to: payload.rules.auto,
    p_admin_above: payload.rules.admin,
    p_alert_pct: payload.rules.alert,
    p_workers_see: payload.rules.workersSee
  });
  if (error) return { error: /duplicate key/.test(error.message) ? 'That project code is already used.' : error.message };
  done(['/projects', '/overview']);
  return { ok: data as string };
}

export async function addFunds(payload: {
  project_id: string; amount: number; method: string; reference: string; received_on: string; proof_path: string; proof_name: string; note: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('add_funds', {
    p_project: payload.project_id,
    p_amount: payload.amount,
    p_method: payload.method,
    p_reference: payload.reference,
    p_received: payload.received_on || null,
    p_proof_path: payload.proof_path,
    p_proof_name: payload.proof_name,
    p_note: payload.note || null
  });
  if (error) return { error: error.message };
  done(['/projects', `/projects/${payload.project_id}`, '/overview', '/budget-changes']);
  return { ok: data as string };
}

export async function requestBudgetChange(payload: {
  project_id: string; kind: string; amount: number; target_id: string | null; reason: string; reference: string; note: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('request_budget_change', {
    p_project: payload.project_id,
    p_kind: payload.kind,
    p_amount: payload.amount,
    p_target: payload.target_id,
    p_reason: payload.reason,
    p_reference: payload.reference || null,
    p_note: payload.note
  });
  if (error) return { error: error.message };
  done(['/projects', `/projects/${payload.project_id}`, '/overview', '/budget-changes']);
  return { ok: data as string };
}

export async function decideBudgetChange(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc('decide_budget_change', {
    p_change: str(form, 'change_id'),
    p_approve: str(form, 'decision') === 'approve',
    p_note: str(form, 'note') || null
  });
  if (error) return { error: error.message };
  done(['/budget-changes', '/projects', '/overview']);
  return { ok: 'Saved' };
}

export async function setProjectStatus(projectId: string, status: 'active' | 'completed') {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('projects').update({ status }).eq('id', projectId);
  if (error) return { error: error.message };
  done(['/projects', `/projects/${projectId}`, '/overview']);
  return { ok: 'Saved' };
}

export async function updateProjectRules(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const id = str(form, 'project_id');
  const { error } = await supabase
    .from('projects')
    .update({
      receipt_required_above: optNum(form, 'receipt_required_above'),
      auto_approve_up_to: optNum(form, 'auto_approve_up_to'),
      admin_approval_above: optNum(form, 'admin_approval_above'),
      alert_below_pct: optNum(form, 'alert_below_pct'),
      workers_see_balance: form.get('workers_see_balance') === 'on'
    })
    .eq('id', id);
  if (error) return { error: error.message };
  done([`/projects/${id}`]);
  return { ok: 'Rules saved' };
}

export async function updateMemberLimit(projectId: string, userId: string, limit: number) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('project_members').update({ monthly_limit: limit }).eq('project_id', projectId).eq('user_id', userId);
  if (error) return { error: error.message };
  done([`/projects/${projectId}`]);
  return { ok: 'Saved' };
}

export async function addProjectMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, company } = await requireAdmin();
  const projectId = str(form, 'project_id');
  const { error } = await supabase.from('project_members').upsert({
    project_id: projectId,
    user_id: str(form, 'user_id'),
    monthly_limit: optNum(form, 'monthly_limit') ?? company.default_monthly_limit
  });
  if (error) return { error: error.message };
  done([`/projects/${projectId}`]);
  return { ok: 'Added' };
}

export async function removeProjectMember(projectId: string, userId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('project_members').delete().eq('project_id', projectId).eq('user_id', userId);
  if (error) return { error: error.message };
  done([`/projects/${projectId}`]);
  return { ok: 'Removed' };
}

// ---------------------------------------------------------------- Reimbursements

export async function payReimbursements(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const person = str(form, 'person');
  const { error } = await supabase.rpc('pay_reimbursements', {
    p_people: person ? [person] : null,
    p_reference: str(form, 'reference') || null,
    p_proof_path: str(form, 'proof_path') || null
  });
  if (error) return { error: error.message };
  done(['/reimbursements', '/my']);
  return { ok: 'Marked as paid' };
}

// ---------------------------------------------------------------- Team

export async function addTeamMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, company, profile } = await requireAdmin();
  const fullName = str(form, 'full_name');
  const email = str(form, 'email').toLowerCase();
  const rawPhone = str(form, 'phone').replace(/[^\d+]/g, '');
  const phone = rawPhone ? (rawPhone.startsWith('+') ? rawPhone : '+' + rawPhone) : '';
  const role = str(form, 'role') || 'worker';
  if (!fullName) return { error: 'Enter their name' };
  if (!email && !phone) return { error: 'Add an email or a mobile number so they can sign in' };
  if (role === 'owner' && profile.role !== 'owner') return { error: 'Only the owner can add another owner' };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' };

  const admin = createAdminClient();
  const { data: created, error: authError } = await admin.auth.admin.createUser({
    ...(email ? { email, email_confirm: true } : {}),
    ...(phone ? { phone, phone_confirm: true } : {}),
    user_metadata: { full_name: fullName }
  });
  if (authError || !created.user) {
    return { error: /already been registered|already exists/i.test(authError?.message ?? '') ? 'Someone with that email or number already has a login. They may belong to another workspace.' : authError?.message ?? 'Could not create the login' };
  }

  const { error } = await admin.from('profiles').insert({
    id: created.user.id,
    company_id: company.id,
    full_name: fullName,
    email: email || null,
    phone: phone || null,
    role
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: error.message };
  }

  const projectId = str(form, 'project_id');
  if (projectId) {
    await supabase.from('project_members').insert({ project_id: projectId, user_id: created.user.id, monthly_limit: optNum(form, 'monthly_limit') ?? company.default_monthly_limit });
  }
  await admin.from('audit_log').insert({
    company_id: company.id, actor_id: profile.id, kind: 'people',
    text: `Invited ${fullName} as ${role[0]!.toUpperCase() + role.slice(1)}${email ? ' · ' + email : ''}${phone ? ' · ' + phone : ''}`
  });
  done(['/team']);
  return { ok: `${fullName} can now sign in with ${email || phone}` };
}

export async function updateTeamMember(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, profile } = await requireAdmin();
  const id = str(form, 'id');
  const role = str(form, 'role');
  if (id === profile.id && role !== profile.role) return { error: 'You can’t change your own role' };
  if (role === 'owner' && profile.role !== 'owner') return { error: 'Only the owner can make someone an owner' };
  const { data: target } = await supabase.from('profiles').select('role').eq('id', id).single();
  if (target?.role === 'owner' && profile.role !== 'owner') return { error: 'Only the owner can change an owner' };
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: str(form, 'full_name'), role, bank_details: str(form, 'bank_details') || null, active: form.get('active') === 'on' })
    .eq('id', id);
  if (error) return { error: error.message };
  done(['/team']);
  return { ok: 'Saved' };
}

export async function updateMyBankDetails(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in' };
  const { error } = await supabase.from('profiles').update({ bank_details: str(form, 'bank_details') || null }).eq('id', user.id);
  if (error) return { error: error.message };
  done(['/my']);
  return { ok: 'Saved' };
}

// ---------------------------------------------------------------- Settings

export async function saveSettings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, company } = await requireAdmin();
  const { error } = await supabase
    .from('companies')
    .update({
      name: str(form, 'name') || company.name,
      currency: str(form, 'currency'),
      fy_start: str(form, 'fy_start'),
      timezone: str(form, 'timezone'),
      receipt_required_above: optNum(form, 'receipt_required_above') ?? 0,
      auto_approve_up_to: optNum(form, 'auto_approve_up_to') ?? 0,
      admin_approval_above: optNum(form, 'admin_approval_above') ?? 0,
      default_monthly_limit: optNum(form, 'default_monthly_limit') ?? 0,
      signoff_above: optNum(form, 'signoff_above') ?? 0,
      alert_below_pct: optNum(form, 'alert_below_pct') ?? 0,
      flag_duplicates: form.get('flag_duplicates') === 'true',
      workers_see_balance: form.get('workers_see_balance') === 'true',
      workers_phone_signin: form.get('workers_phone_signin') === 'true',
      session_timeout: str(form, 'session_timeout'),
      notify_new_claim: str(form, 'notify_new_claim'),
      notify_low_balance: str(form, 'notify_low_balance'),
      notify_signoff: str(form, 'notify_signoff'),
      notify_weekly: str(form, 'notify_weekly')
    })
    .eq('id', company.id);
  if (error) return { error: error.message };
  await supabase.rpc('record_settings_change');
  done(['/settings']);
  return { ok: 'Settings saved' };
}

export async function addCategory(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const { supabase, company } = await requireAdmin();
  const name = str(form, 'name');
  if (!name) return { error: 'Enter a name' };
  const { error } = await supabase.from('categories').insert({ company_id: company.id, name });
  if (error) return { error: /duplicate/.test(error.message) ? 'That category already exists' : error.message };
  done(['/settings']);
  return { ok: 'Added' };
}

export async function renameCategory(id: string, name: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from('categories').update({ name }).eq('id', id);
  if (error) return { error: error.message };
  done(['/settings']);
  return { ok: 'Saved' };
}
