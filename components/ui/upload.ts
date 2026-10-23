'use client';

import { createClient } from '@/lib/supabase/client';

export const MAX_FILE_MB = 20;
export const ACCEPT = 'application/pdf,image/jpeg,image/png,image/heic,image/webp';

export interface Uploaded {
  path: string;
  name: string;
  size: number;
}

/** Uploads to the private `proofs` bucket under the company's folder. */
export async function uploadProof(companyId: string, folder: string, file: File): Promise<Uploaded> {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB`);
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${companyId}/${folder}/${crypto.randomUUID()}-${safe}`;
  const { error } = await createClient().storage.from('proofs').upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw new Error(error.message);
  return { path, name: file.name, size: file.size };
}

export const kb = (bytes: number) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
