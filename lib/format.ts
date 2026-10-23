export const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** "12,345.50" → 12345.5 */
export const parseAmount = (s: string) => {
  const n = parseFloat(String(s).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

/** ₹12,345.50 */
export const money = (v: unknown, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num(v));

/** 23 Oct 2026, 2:32 pm */
export const stamp = (iso: string, tz = 'Asia/Kolkata') =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
  }).format(new Date(iso));

export const initials = (name?: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

export const FUND_METHOD_LABEL: Record<string, string> = { bank_transfer: 'Bank transfer', cheque: 'Cheque', cash: 'Cash', card_topup: 'Card top-up' };
