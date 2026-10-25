import type { ReactionKind } from '@/constants/reactions';
import { supabase } from '@/lib/supabase';

/** Leave (or change) your word on a post. One per person per post. */
export async function setReaction(postId: string, userId: string, kind: ReactionKind): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .upsert({ post_id: postId, user_id: userId, kind }, { onConflict: 'post_id,user_id' });
  if (error) throw new Error(error.message);
}

/** Take your word back. */
export async function clearReaction(postId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('reactions')
    .delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
