'use client';

export function PrintButton() {
  return <button type="button" className="btn dark" onClick={() => window.print()}>Download PDF report</button>;
}
