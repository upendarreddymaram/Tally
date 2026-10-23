import { requireMember } from '@/lib/session';

export default async function SheetLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  return <div className="sheet-wrap">{children}</div>;
}
