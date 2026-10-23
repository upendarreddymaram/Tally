import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Handles the magic link in Supabase emails (if the email template uses a link instead of a code).
// Template link: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = (searchParams.get('type') ?? 'email') as EmailOtpType;
  const code = searchParams.get('code');
  const supabase = await createClient();

  let ok = false;
  if (token_hash) ok = !(await supabase.auth.verifyOtp({ type, token_hash })).error;
  else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;

  if (ok) {
    await supabase.rpc('record_sign_in', { p_source: 'Web' });
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.redirect(new URL('/sign-in?error=link', request.url));
}
