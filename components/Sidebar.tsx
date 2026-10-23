import Link from 'next/link';
import { BrandMark, Icon } from './Icon';
import { NavLinks, type NavItem } from './NavLinks';
import { initials, ROLE_LABEL } from '@/lib/format';
import type { Company, Profile } from '@/lib/types';

export function Shell({
  company, profile, items, children
}: { company: Company; profile: Profile; items: NavItem[]; children: React.ReactNode }) {
  const roleLine = profile.role === 'owner' ? 'Owner · full access' : ROLE_LABEL[profile.role];
  const signOut = (
    <form action="/auth/sign-out" method="post">
      <button type="submit" aria-label="Sign out" className="icon-btn ghost" style={{ width: 44, height: 44, color: 'var(--muted)' }}>
        <Icon name="signout" />
      </button>
    </form>
  );
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/" className="brand">
          <BrandMark />
          <span className="brand-name">Tally</span>
        </Link>
        <div className="workspace">
          <span className="av sq">{initials(company.name)}</span>
          <span className="col grow" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>{company.name}</span>
            <span className="small muted">{ROLE_LABEL[profile.role]} workspace</span>
          </span>
        </div>
        <NavLinks items={items} label="Main" />
        <div style={{ flex: '1 1 auto' }} />
        <div className="side-user">
          <span className="av s36">{initials(profile.full_name)}</span>
          <span className="col grow" style={{ gap: 1 }}>
            <span style={{ fontWeight: 600 }}>{profile.full_name}</span>
            <span className="small muted">{roleLine}</span>
          </span>
          {signOut}
        </div>
      </aside>
      <header className="topbar">
        <div className="row between">
          <Link href="/" className="brand" style={{ padding: 0 }}>
            <BrandMark size={28} />
            <span className="brand-name" style={{ fontSize: 19 }}>Tally</span>
          </Link>
          <div className="row" style={{ gap: 6 }}>
            <span className="small muted">{profile.full_name}</span>
            {signOut}
          </div>
        </div>
        <NavLinks items={items} label="Main mobile" />
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
