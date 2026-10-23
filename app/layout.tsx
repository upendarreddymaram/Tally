import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

const font = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font' });

export const metadata: Metadata = {
  title: { default: 'Tally', template: '%s · Tally' },
  description: 'Project budgets and expenses, with proof.'
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#4F46E5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={font.variable}>
      <body>{children}</body>
    </html>
  );
}
