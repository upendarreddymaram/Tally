import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { SettingsForm, Categories } from './SettingsForm';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const { supabase, company } = await requireAdmin();
  const [{ data: cats }, { data: used }] = await Promise.all([
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('expenses').select('category_id')
  ]);
  const counts = new Map<string, number>();
  for (const e of used ?? []) if (e.category_id) counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1);

  return (
    <>
      <div className="col" style={{ gap: 6 }}>
        <h1 className="h1">Settings</h1>
        <span className="muted">Company-wide defaults. Each project can override the spending rules.</span>
      </div>
      <div className="row wrap" style={{ gap: 22, alignItems: 'flex-start' }}>
        <nav aria-label="Settings sections" className="nav" style={{ flex: '1 1 200px', maxWidth: 240, position: 'sticky', top: 20 }}>
          {[['company', 'Company'], ['rules', 'Spending rules'], ['categories', 'Categories'], ['notify', 'Notifications'], ['security', 'Security']].map(([id, label]) => (
            <a key={id} href={`#${id}`}>{label}</a>
          ))}
        </nav>
        <div className="col" style={{ flex: '999 1 560px', minWidth: 0, gap: 20 }}>
          <SettingsForm company={company}>
            <Categories cats={(cats ?? []).map((c) => ({ ...c, n: counts.get(c.id) ?? 0 }))} />
          </SettingsForm>
        </div>
      </div>
    </>
  );
}
