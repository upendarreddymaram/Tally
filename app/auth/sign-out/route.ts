import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/sign-in', request.url), { status: 303 });
}

// Used when an account has been turned off: end the session and explain why.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const reason = request.nextUrl.searchParams.get('reason');
  return NextResponse.redirect(new URL(reason ? `/sign-in?error=${encodeURIComponent(reason)}` : '/sign-in', request.url));
}
