import { supabase } from '@/lib/supabase';
import type { PostAuthor } from '@/types';

/**
 * Follow graph access. RLS only ever exposes the caller's own outgoing
 * follows, so every read here is "who do I follow", never "who follows me".
 */

/** Ids of everyone the user follows. */
export async function fetchFollowingIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);
  if (error) throw new Error(error.message);
  return (data as { following_id: string }[]).map((row) => row.following_id);
}

export interface FollowedProfile extends PostAuthor {
  id: string;
  /** When the user chose to follow this person. */
  followed_at: string;
}

/** The people the user follows, most recently followed first. */
export async function fetchFollowingProfiles(userId: string): Promise<FollowedProfile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select(
      `following_id, created_at,
       profile:profiles!follows_following_id_fkey ( username, display_name, avatar_url )`,
    )
    .eq('follower_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data as unknown as {
    following_id: string;
    created_at: string;
    profile: PostAuthor;
  }[];
  return rows.map((row) => ({
    id: row.following_id,
    followed_at: row.created_at,
    ...row.profile,
  }));
}

/** Idempotent: following someone twice is a no-op, not an error. */
export async function follow(userId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .upsert({ follower_id: userId, following_id: targetId }, { ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/** Idempotent: unfollowing someone you don't follow is a no-op. */
export async function unfollow(userId: string, targetId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', userId)
    .eq('following_id', targetId);
  if (error) throw new Error(error.message);
}
