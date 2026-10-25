import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vercel rejects env names containing NEXT_PUBLIC_…KEY, so also accept NEXT_SUPABASE_URL / NEXT_SUPABASE_ANON_KEY.
  // These are inlined at build time so browser code can read them too.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_SUPABASE_URL ?? '',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_SUPABASE_ANON_KEY ?? ''
  },
  experimental: {
    serverActions: { bodySizeLimit: '2mb' }
  }
};

export default nextConfig;
