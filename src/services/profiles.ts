import { tStatic } from '@/i18n/active';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}

export interface ProfileUpdate {
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
}

export async function updateProfile(
  userId: string,
  update: ProfileUpdate,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId);
  if (error) {
    if (error.code === '23505') {
      throw new Error(tStatic('error.usernameTaken'));
    }
    throw new Error(error.message);
  }
}
