import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { initials, ROLE_LABEL, when } from '@/lib/format';
import type { Profile } from '@/lib/types';
import { AddMemberForm, EditMember } from './TeamClient';

export const metadata: Metadata = { title: 'Team & roles' };

export default async function TeamPage() {
  const { supabase, company, profile } = await requireAdmin();
  const [{ data: people }, { data: memberships }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('*').order('active', { ascending: false }).order('full_name'),
    supabase.from('project_members').select('user_id, project:projects(name, status)'),
    supabase.from('projects').select('id, name').eq('status', 'active').order('name')
  ]);
  const byUser = new Map<string, string[]>();
  for (const m of (memberships ?? []) as unknown as { user_id: string; project: { name: string; status: string } | null }[]) {
    if (m.project?.status === 'active') byUser.set(m.user_id, [...(byUser.get(m.user_id) ?? []), m.project.name]);
  }
  const list = (people ?? []) as Profile[];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">Team &amp; roles</h1>
          <span className="muted">{list.filter((p) => p.active).length} people · Owners and admins manage money, approvers decide claims, workers submit them.</span>
        </div>
      </div>
      <div className="split" style={{ gap: 22 }}>
        <section aria-label="People" className="card clip wide">
          <div className="tbl">
            <div className="tbl-inner" style={{ ['--minw' as string]: '780px', ['--cols' as string]: '2fr 1.6fr 1fr 1.6fr 1fr 44px' }}>
              <div className="tr th" style={{ borderTop: 0 }}><span>Person</span><span>Signs in with</span><span>Role</span><span>Projects</span><span>Last seen</span><span /></div>
              {list.map((p) => (
                <div key={p.id} className={`tr ${p.active ? '' : 'dim'}`}>
                  <span className="row" style={{ gap: 10, minWidth: 0 }}>
                    <span className="av grey s30">{initials(p.full_name)}</span>
                    <span className="col" style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{p.full_name}{p.id === profile.id ? ' (you)' : ''}</span>
                      <span className="small muted">{p.bank_details ? `Bank ${p.bank_details}` : 'No bank details'}</span>
                    </span>
                  </span>
                  <span className="mono small ink2" style={{ overflowWrap: 'anywhere' }}>{[p.email, p.phone].filter(Boolean).join(' · ')}</span>
                  <span><span className={`pill ${p.role === 'owner' || p.role === 'admin' ? 'red' : ''}`}>{ROLE_LABEL[p.role]}</span>{!p.active ? <span className="pill grey" style={{ marginLeft: 4 }}>Off</span> : null}</span>
                  <span className="s13 ink2">{(byUser.get(p.id) ?? []).join(', ') || '—'}</span>
                  <span className="small muted">{p.last_seen_at ? when(p.last_seen_at, company.timezone) : <span className="pill grey">Invited</span>}</span>
                  <EditMember person={p} isOwner={profile.role === 'owner'} self={p.id === profile.id} />
                </div>
              ))}
            </div>
          </div>
        </section>
        <section aria-label="Add someone" className="narrow">
          <div className="card pad-lg col" style={{ gap: 14 }}>
            <h2 className="h2">Add someone</h2>
            <span className="small muted" style={{ lineHeight: 1.45 }}>
              They sign in with a one-time code sent to their email, or by SMS to their phone. Nothing is sent until they open the app and ask for a code — share the link with them.
            </span>
            <AddMemberForm projects={projects ?? []} defaultLimit={Number(company.default_monthly_limit)} canMakeOwner={profile.role === 'owner'} />
          </div>
        </section>
      </div>
    </>
  );
}
