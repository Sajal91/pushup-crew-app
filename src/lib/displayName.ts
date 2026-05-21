import type { User as SupabaseUser } from '@supabase/supabase-js';

const MAX_NAME = 16;

export function clampDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'BRO';
  return trimmed.length > MAX_NAME ? trimmed.slice(0, MAX_NAME) : trimmed;
}

export function displayNameFromSupabaseUser(user: SupabaseUser): string {
  const meta = user.user_metadata ?? {};
  const full =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    '';
  if (full.trim()) return clampDisplayName(full);

  const given = typeof meta.given_name === 'string' ? meta.given_name : '';
  const family = typeof meta.family_name === 'string' ? meta.family_name : '';
  const combined = [given, family].filter(Boolean).join(' ').trim();
  if (combined) return clampDisplayName(combined);

  if (user.email) {
    const local = user.email.split('@')[0]?.replace(/[._]/g, ' ').trim();
    if (local) return clampDisplayName(local);
  }
  return 'BRO';
}
