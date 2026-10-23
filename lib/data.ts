import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { num } from '@/lib/format';

// Reads go through the service-role client, always scoped to the signed-in person's company.
// Callers must pass the company id from requireMember().

export interface ProjectRow {
  id: string;
  code: string;
  name: string;
  budget: number;
  spent: number;
  remaining: number;
}

export async function getProjects(companyId: string): Promise<ProjectRow[]> {
  const db = createAdminClient();
  const [{ data: projects }, { data: stats }] = await Promise.all([
    db.from('projects').select('id, code, name, budget').eq('company_id', companyId).order('created_at', { ascending: false }),
    db.from('project_stats').select('project_id, spent, held').eq('company_id', companyId)
  ]);
  const byId = new Map((stats ?? []).map((s) => [s.project_id as string, s]));
  return (projects ?? []).map((p) => {
    const s = byId.get(p.id);
    const spent = num(s?.spent) + num(s?.held);
    return { id: p.id, code: p.code, name: p.name, budget: num(p.budget), spent, remaining: num(p.budget) - spent };
  });
}

export interface Entry {
  id: string;
  kind: 'expense' | 'funds';
  title: string;
  amount: number;
  at: string;
  projectId: string;
  projectName: string;
  by: string;
  note: string | null;
  files: { name: string; url: string | null }[];
}

/** Every expense and every top-up, newest first. */
export async function getHistory(companyId: string, projectId?: string): Promise<Entry[]> {
  const db = createAdminClient();
  let fq = db.from('funding').select('id, amount, created_at, note, proof_path, proof_name, project_id, created_by, method, reference').eq('company_id', companyId);
  let eq = db.from('expenses').select('id, title, amount, created_at, note, project_id, submitted_by, expense_files(path, name)').eq('company_id', companyId);
  if (projectId) {
    fq = fq.eq('project_id', projectId);
    eq = eq.eq('project_id', projectId);
  }
  const [{ data: funds }, { data: expenses }, { data: people }, { data: projects }] = await Promise.all([
    fq,
    eq,
    db.from('profiles').select('id, full_name').eq('company_id', companyId),
    db.from('projects').select('id, name').eq('company_id', companyId)
  ]);
  const who = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]));
  const proj = new Map((projects ?? []).map((p) => [p.id as string, p.name as string]));

  const paths = [
    ...(funds ?? []).map((f) => f.proof_path as string),
    ...(expenses ?? []).flatMap((e) => ((e.expense_files as { path: string }[]) ?? []).map((x) => x.path))
  ].filter(Boolean);
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await db.storage.from('proofs').createSignedUrls(paths, 3600);
    (data ?? []).forEach((s) => s.path && s.signedUrl && signed.set(s.path, s.signedUrl));
  }

  const entries: Entry[] = [
    ...(funds ?? []).map((f) => ({
      id: f.id as string,
      kind: 'funds' as const,
      title: f.note === 'Opening budget' ? 'Opening budget' : 'Funds added',
      amount: num(f.amount),
      at: f.created_at as string,
      projectId: f.project_id as string,
      projectName: proj.get(f.project_id as string) ?? '—',
      by: who.get(f.created_by as string) ?? '—',
      note: f.note === 'Opening budget' ? null : (f.note as string | null),
      files: f.proof_path ? [{ name: (f.proof_name as string) || 'Proof', url: signed.get(f.proof_path as string) ?? null }] : []
    })),
    ...(expenses ?? []).map((e) => ({
      id: e.id as string,
      kind: 'expense' as const,
      title: e.title as string,
      amount: num(e.amount),
      at: e.created_at as string,
      projectId: e.project_id as string,
      projectName: proj.get(e.project_id as string) ?? '—',
      by: who.get(e.submitted_by as string) ?? '—',
      note: e.note as string | null,
      files: ((e.expense_files as { path: string; name: string }[]) ?? []).map((x) => ({ name: x.name, url: signed.get(x.path) ?? null }))
    }))
  ];
  return entries.sort((a, b) => (a.at < b.at ? 1 : -1));
}
