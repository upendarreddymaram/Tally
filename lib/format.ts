export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** 12,345 */
export const whole = (v: unknown) => Math.round(num(v)).toLocaleString('en-US');

/** 12,345.00 */
export const money = (v: unknown) =>
  num(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "12,345" → 12345 */
export const parseAmount = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type Parts = { y: number; m: number; d: number; wd: number; hh: string; mm: string };

export function parts(iso: string | Date, tz = 'Asia/Dubai'): Parts {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const get = (t: string) => f.find((p) => p.type === t)?.value ?? '';
  return { y: +get('year'), m: +get('month') - 1, d: +get('day'), wd: DAYS.indexOf(get('weekday')), hh: get('hour'), mm: get('minute') };
}

/** 23 Oct */
export const dayMonth = (iso: string | Date, tz?: string) => {
  const p = parts(iso, tz);
  return `${String(p.d).padStart(2, '0')} ${MONTHS[p.m]}`;
};
/** 23 Oct 2026 */
export const fullDate = (iso: string | Date, tz?: string) => {
  const p = parts(iso, tz);
  return `${p.d} ${MONTHS[p.m]} ${p.y}`;
};
/** 10:42 */
export const time = (iso: string | Date, tz?: string) => {
  const p = parts(iso, tz);
  return `${p.hh}:${p.mm}`;
};
/** Today 10:42 / Yest. 17:30 / 21 Oct 13:47 */
export function when(iso: string, tz?: string) {
  const p = parts(iso, tz);
  const now = parts(new Date(), tz);
  const key = (x: Parts) => x.y * 400 + x.m * 32 + x.d;
  const diff = (Date.UTC(now.y, now.m, now.d) - Date.UTC(p.y, p.m, p.d)) / 86400000;
  if (key(p) === key(now)) return `Today ${p.hh}:${p.mm}`;
  if (diff === 1) return `Yest. ${p.hh}:${p.mm}`;
  return `${dayMonth(iso, tz)} ${p.hh}:${p.mm}`;
}
/** 2 h / 19 h / 3 d */
export function age(iso: string) {
  const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.round(mins)} m`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h`;
  return `${Math.round(mins / 1440)} d`;
}
/** Fri 23 Oct 2026 · Week 43 */
export function todayLine(tz?: string) {
  const p = parts(new Date(), tz);
  const d = new Date(Date.UTC(p.y, p.m, p.d));
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${DAYS[p.wd]} ${p.d} ${MONTHS[p.m]} ${p.y} · Week ${week}`;
}
export function greeting(tz?: string) {
  const h = +parts(new Date(), tz).hh;
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
export const dayLabel = (iso: string, tz?: string) => {
  const p = parts(iso, tz);
  const now = parts(new Date(), tz);
  const diff = (Date.UTC(now.y, now.m, now.d) - Date.UTC(p.y, p.m, p.d)) / 86400000;
  if (diff === 0) return `Today · ${dayMonth(iso, tz)}`;
  if (diff === 1) return `Yesterday · ${dayMonth(iso, tz)}`;
  return dayMonth(iso, tz);
};

export const initials = (name?: string | null) =>
  (name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

export const shortName = (name?: string | null) => {
  const [a, b] = (name ?? '').split(/\s+/);
  return b ? `${a} ${b[0]}.` : a ?? '';
};
export const firstName = (name?: string | null) => (name ?? '').split(/\s+/)[0] ?? '';

export const ROLE_LABEL: Record<string, string> = { owner: 'Owner', admin: 'Admin', approver: 'Approver', worker: 'Worker' };
export const FUND_METHOD_LABEL: Record<string, string> = { bank_transfer: 'Bank transfer', cheque: 'Cheque', cash: 'Cash', card_topup: 'Card top-up' };
export const PAY_METHOD_LABEL: Record<string, string> = { project_card: 'Project card', cash_float: 'Cash float', own_money: 'Own money', bank_transfer: 'Bank transfer' };
export const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting', info_requested: 'Reply needed', approved: 'Approved', part_approved: 'Part-approved', rejected: 'Rejected'
};

export function csv(rows: (string | number | null | undefined)[][]) {
  return rows
    .map((r) => r.map((c) => {
      const s = c == null ? '' : String(c);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(','))
    .join('\n');
}

export function periodStart(p: string) {
  const now = new Date();
  if (p === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'quarter') return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  if (p === 'year') return new Date(now.getFullYear(), 0, 1);
  return null;
}
