'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './Icon';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  badge?: number;
  group?: string;
}

export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const path = usePathname();
  return (
    <nav aria-label={label} className="nav">
      {items.map((n) => {
        const on = path === n.href || path.startsWith(n.href + '/');
        return (
          <div key={n.href} style={{ display: 'contents' }}>
            {n.group ? <span className="nav-group">{n.group}</span> : null}
            <Link href={n.href} aria-current={on ? 'page' : undefined}>
              <Icon name={n.icon} width={1.9} />
              <span style={{ flex: '1 1 auto' }}>{n.label}</span>
              {n.badge ? <span className="badge">{n.badge}</span> : null}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
