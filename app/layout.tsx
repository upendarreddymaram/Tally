import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const bricolage = Bricolage_Grotesque({ subsets: ['latin'], weight: ['500', '700', '800'], variable: '--font-bricolage' });
const geist = Geist({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: { default: 'Tally', template: '%s · Tally' },
  description: 'Project budgets, funding with proof, and expense approvals.'
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#E11D2E' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bricolage.variable} ${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
