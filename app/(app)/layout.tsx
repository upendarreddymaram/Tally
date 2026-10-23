import Link from 'next/link';
import { BrandMark } from '@/components/Brand';
import { TopNav } from '@/components/TopNav';
import { requireMember } from '@/lib/session';
import { initials } from '@/lib/format';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireMember();
  return (
    <>
      <header className="top">
        <div className="top-in">
          <Link href="/projects" className="brand">
            <BrandMark size={30} />
            <span>Tally</span>
          </Link>
          <TopNav />
          <div className="grow" />
          <Link href="/expenses/new" className="btn primary">+ Add expense</Link>
          <span className="who" title={profile.full_name}>
            <span className="av">{initials(profile.full_name)}</span>
            <span className="who-name">{profile.full_name}</span>
          </span>
          <form action="/auth/sign-out" method="post">
            <button className="btn ghost sm" type="submit">Sign out</button>
          </form>
        </div>
      </header>
      <main className="page">{children}</main>
    </>
  );
}
