import { money, stamp } from '@/lib/format';
import type { Entry } from '@/lib/data';

export function HistoryList({ items, currency, tz, showProject }: { items: Entry[]; currency: string; tz: string; showProject?: boolean }) {
  if (!items.length) return <div className="empty">Nothing here yet.</div>;
  return (
    <ul className="list">
      {items.map((e) => (
        <li key={`${e.kind}-${e.id}`} className="item">
          <span className={`dot ${e.kind}`}>{e.kind === 'funds' ? '↑' : '↓'}</span>
          <div className="grow">
            <div className="item-title">{e.title}</div>
            <div className="muted small">
              {showProject ? <>{e.projectName} · </> : null}
              {e.by} · {stamp(e.at, tz)}
            </div>
            {e.note ? <div className="small note">{e.note}</div> : null}
            {e.files.length ? (
              <div className="small">
                {e.files.map((f, i) =>
                  f.url ? <a key={i} href={f.url} target="_blank" rel="noreferrer" className="proof">📎 {f.name}</a> : <span key={i} className="muted">{f.name}</span>
                )}
              </div>
            ) : null}
          </div>
          <b className={e.kind === 'funds' ? 'pos amt' : 'amt'}>{e.kind === 'funds' ? '+' : '−'}{money(e.amount, currency)}</b>
        </li>
      ))}
    </ul>
  );
}
