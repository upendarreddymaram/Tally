import Link from 'next/link';
import type { Metadata } from 'next';
import { requireApprover } from '@/lib/session';
import { money, PAY_METHOD_LABEL, periodStart, STATUS_LABEL, when } from '@/lib/format';

export const metadata: Metadata = { title: 'All expenses' };

const PAGE = 25;
const PERIODS = { month: 'This month', quarter: 'This quarter', year: 'This year', all: 'All time' } as const;

type SP = { q?: string; project?: string; period?: string; status?: string; category?: string; receipt?: string; page?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, company } = await requireApprover();
  const tz = company.timezone;
  const period = sp.period && sp.period in PERIODS ? sp.period : 'month';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const start = periodStart(period);
  const term = (sp.q ?? '').replace(/[%,()*]/g, ' ').trim();
  let people: string[] = [];
  if (term) {
    const { data: ppl } = await supabase.from('profiles').select('id').ilike('full_name', `%${term}%`);
    people = (ppl ?? []).map((p) => p.id);
  }

  let q = supabase
    .from('expenses')
    .select('id, ref, title, vendor, amount, approved_amount, status, paid_at, pay_method, card_last4, submitter:profiles!expenses_submitted_by_fkey(full_name), project:projects(name), category:categories(name), expense_files(count)', { count: 'exact' })
    .order('paid_at', { ascending: false })
    .range((page - 1) * PAGE, page * PAGE - 1);
  if (start) q = q.gte('paid_at', start.toISOString());
  if (sp.project) q = q.eq('project_id', sp.project);
  if (sp.status) q = q.eq('status', sp.status);
  if (sp.category) q = q.eq('category_id', sp.category);
  if (sp.receipt === '1') q = q.contains('flags', ['No receipt']);
  if (term) q = q.or([`title.ilike.%${term}%`, `vendor.ilike.%${term}%`, `ref.ilike.%${term}%`, ...(people.length ? [`submitted_by.in.(${people.join(',')})`] : [])].join(','));

  const quarterStart = periodStart('quarter')!.toISOString();
  const [{ data: rows, count }, { data: projects }, { data: cats }, { data: qStats }] = await Promise.all([
    q,
    supabase.from('projects').select('id, name').order('name'),
    supabase.from('categories').select('id, name').order('name'),
    supabase.from('expenses').select('status').gte('paid_at', quarterStart)
  ]);

  type Row = {
    id: string; ref: string; title: string; vendor: string | null; amount: number; approved_amount: number | null; status: string; paid_at: string; pay_method: string; card_last4: string | null;
    submitter: { full_name: string } | null; project: { name: string } | null; category: { name: string } | null; expense_files: { count: number }[];
  };
  const list = (rows ?? []) as unknown as Row[];
  const total = count ?? 0;
  const pageTotal = list.reduce((a, r) => a + Number(r.amount), 0);
  const qs = qStats ?? [];
  const n = (s: string[]) => qs.filter((r) => s.includes(r.status)).length;

  const params = (o: Partial<SP>) => {
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...sp, ...o })) if (v) merged[k] = String(v);
    return new URLSearchParams(merged).toString();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="h1">All expenses</h1>
          <span className="muted">{n(['approved', 'part_approved'])} approved · {n(['pending', 'info_requested'])} waiting · {n(['rejected'])} rejected this quarter</span>
        </div>
        <a href={`/api/export/expenses?${params({ page: undefined })}`} className="btn">Export CSV</a>
      </div>
      <form action="/expenses" className="row wrap" style={{ gap: 8 }}>
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" name="q" type="search" defaultValue={sp.q} placeholder="Search item, worker, supplier or claim ID" className="input" style={{ height: 42, flex: '1 1 260px', width: 'auto' }} />
        <select name="project" aria-label="Project" className="input sm" style={{ width: 'auto', borderRadius: 999 }} defaultValue={sp.project ?? ''}>
          <option value="">All projects</option>
          {(projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select name="period" aria-label="Period" className="input sm" style={{ width: 'auto', borderRadius: 999 }} defaultValue={period}>
          {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="status" aria-label="Status" className="input sm" style={{ width: 'auto', borderRadius: 999 }} defaultValue={sp.status ?? ''}>
          <option value="">Any status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select name="category" aria-label="Category" className="input sm" style={{ width: 'auto', borderRadius: 999 }} defaultValue={sp.category ?? ''}>
          <option value="">Any category</option>
          {(cats ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="chip" aria-pressed={sp.receipt === '1'} style={{ gap: 8 }}>
          <input type="checkbox" name="receipt" value="1" defaultChecked={sp.receipt === '1'} className="check" style={{ width: 14, height: 14 }} />Needs receipt
        </label>
        <button className="btn dark md">Apply</button>
      </form>
      <section aria-label="Expenses" className="card clip">
        <div className="tbl">
          <div className="tbl-inner" style={{ ['--minw' as string]: '980px', ['--cols' as string]: '96px 2.2fr 1.2fr 1.2fr 1fr 1fr 1fr 110px' }}>
            <div className="tr th" style={{ borderTop: 0 }}><span>Claim</span><span>Expense</span><span>Worker</span><span>Project</span><span>Category</span><span>Paid on</span><span className="right">{company.currency}</span><span>Status</span></div>
            {list.map((r) => (
              <div key={r.id} className="tr">
                <Link href={`/approvals?id=${r.id}`} className="mono small" style={{ textDecoration: 'none' }}>{r.ref}</Link>
                <span className="row" style={{ gap: 10, minWidth: 0 }}>
                  <span className={`receipt-thumb sm ${(r.expense_files?.[0]?.count ?? 0) > 0 ? '' : 'none'}`} />
                  <span className="col" style={{ gap: 2, minWidth: 0 }}>
                    <span style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>
                    <span className="small muted">{PAY_METHOD_LABEL[r.pay_method]}{r.card_last4 ? ` •• ${r.card_last4}` : ''}{r.vendor ? ` · ${r.vendor}` : ''}</span>
                  </span>
                </span>
                <span className="s13">{r.submitter?.full_name}</span>
                <span className="s13 ink2">{r.project?.name}</span>
                <span className="s13 ink2">{r.category?.name ?? '—'}</span>
                <span className="mono small muted">{when(r.paid_at, tz)}</span>
                <span className="mono right" style={{ fontWeight: 600 }}>{money(r.amount)}</span>
                <span className={`pill ${['pending', 'rejected'].includes(r.status) ? 'red' : r.status === 'part_approved' ? 'grey' : ''}`}>{STATUS_LABEL[r.status]}</span>
              </div>
            ))}
            {!list.length ? <div className="empty">No expenses match these filters.</div> : null}
          </div>
        </div>
        <div className="card-foot" style={{ padding: '12px 20px' }}>
          <span>Showing {list.length} of {total} · page total <b className="mono">{company.currency} {money(pageTotal)}</b></span>
          <div className="row" style={{ gap: 6 }}>
            {page > 1 ? <Link href={`/expenses?${params({ page: String(page - 1) })}`} className="btn sm">Previous</Link> : <span className="btn sm" aria-disabled="true">Previous</span>}
            {page * PAGE < total ? <Link href={`/expenses?${params({ page: String(page + 1) })}`} className="btn sm">Next</Link> : <span className="btn sm" aria-disabled="true">Next</span>}
          </div>
        </div>
      </section>
    </>
  );
}
