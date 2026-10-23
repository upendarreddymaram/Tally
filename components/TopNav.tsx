'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function TopNav() {
  const path = usePathname();
  const links = [
    { href: '/projects', label: 'Projects' },
    { href: '/history', label: 'History' }
  ];
  return (
    <nav className="tabs" aria-label="Main">
      {links.map((l) => (
        <Link key={l.href} href={l.href} aria-current={path === l.href || path.startsWith(l.href + '/') ? 'page' : undefined}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
