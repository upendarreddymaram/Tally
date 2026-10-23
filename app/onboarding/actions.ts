'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createWorkspace(_prev: unknown, form: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_company', {
    p_company: String(form.get('company') ?? '').trim(),
    p_full_name: String(form.get('full_name') ?? '').trim()
  });
  if (error) return { error: error.message };
  redirect('/overview');
}
