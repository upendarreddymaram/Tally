import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { num } from './format';
import type { Company, Project, ProjectStats } from './types';

export interface ProjectRow extends Project {
  lead_name: string | null;
  members: number;
  spent: number;
  held: number;
  left: number;
  available: number;
  pending_count: number;
  approved_count: number;
  daily_burn: number;
  runway: number | null;
  pct: number;
  low: boolean;
}

export function rule(project: Partial<Project> | null | undefined, company: Company, key: 'receipt_required_above' | 'auto_approve_up_to' | 'admin_approval_above' | 'alert_below_pct') {
  const v = project?.[key];
  return num(v ?? company[key]);
}

export async function getProjects(supabase: SupabaseClient, company: Company, opts: { id?: string } = {}): Promise<ProjectRow[]> {
  let q = supabase.from('projects').select('*, lead:profiles!projects_lead_id_fkey(full_name), project_members(count)').order('created_at');
  if (opts.id) q = q.eq('id', opts.id);
  const [{ data: projects }, { data: stats }] = await Promise.all([q, supabase.from('project_stats').select('*')]);
  const byId = new Map((stats as ProjectStats[] | null ?? []).map((s) => [s.project_id, s]));

  return ((projects ?? []) as (Project & { lead: { full_name: string } | null; project_members: { count: number }[] })[]).map((p) => {
    const s = byId.get(p.id);
    const budget = num(p.budget);
    const spent = num(s?.spent);
    const held = num(s?.held);
    const left = budget - spent;
    const burn = num(s?.daily_burn);
    const runway = burn > 0 ? Math.floor(left / burn) : null;
    const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    const alertPct = rule(p, company, 'alert_below_pct');
    const low = p.status === 'active' && ((runway !== null && runway < 14) || (budget > 0 && (left / budget) * 100 < alertPct));
    return {
      ...p,
      budget,
      lead_name: p.lead?.full_name ?? null,
      members: p.project_members?.[0]?.count ?? 0,
      spent,
      held,
      left,
      available: left - held,
      pending_count: s?.pending_count ?? 0,
      approved_count: s?.approved_count ?? 0,
      daily_burn: burn,
      runway,
      pct,
      low
    };
  });
}

export const runwayText = (p: ProjectRow) => (p.status === 'completed' ? 'Closed' : p.runway === null ? 'No spend yet' : `≈ ${p.runway} days`);

/** Turns an uploaded storage path into a short-lived link (10 min). */
export async function signedUrls(supabase: SupabaseClient, paths: string[]) {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const { data } = await supabase.storage.from('proofs').createSignedUrls(unique, 600);
  return new Map<string, string>((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}
