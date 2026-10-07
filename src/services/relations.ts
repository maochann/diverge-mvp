import { tStatic } from '@/i18n/active';
import type { TranslationKey } from '@/i18n/translations';
import { supabase } from '@/lib/supabase';
import type { PostAuthor } from '@/types';

/**
 * Follow / mute / block relations. RLS only ever exposes the caller's own
 * outgoing rows, so every read here is "who do I …", never "who … me".
 */

export type RelationKind = 'follow' | 'mute' | 'block';

const TABLES: Record<RelationKind, { table: string; me: string; them: string }> = {
  follow: { table: 'follows', me: 'follower_id', them: 'following_id' },
  mute: { table: 'mutes', me: 'muter_id', them: 'muted_id' },
  block: { table: 'blocks', me: 'blocker_id', them: 'blocked_id' },
};

/** Ids of everyone the user has this relation with. */
export async function fetchRelationIds(kind: RelationKind, userId: string): Promise<string[]> {
  const t = TABLES[kind];
  const { data, error } = await supabase.from(t.table).select(t.them).eq(t.me, userId);
  if (error) throw new Error(error.message);
  return (data as unknown as Record<string, string>[]).map((row) => row[t.them]);
}

export interface RelatedProfile extends PostAuthor {
  id: string;
  /** When the user made this choice. */
  since: string;
}

/** The people on one of the user's lists, most recent first. */
export async function fetchRelatedProfiles(
  kind: RelationKind,
  userId: string,
): Promise<RelatedProfile[]> {
  const t = TABLES[kind];
  const { data, error } = await supabase
    .from(t.table)
    .select(
      `${t.them}, created_at,
       profile:profiles!${t.table}_${t.them}_fkey ( username, display_name, avatar_url )`,
    )
    .eq(t.me, userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data as unknown as (Record<string, string> & {
    created_at: string;
    profile: PostAuthor | null;
  })[];
  // A blocked person's profile is hidden by RLS; show a placeholder name.
  return rows.map((row) => ({
    id: row[t.them],
    since: row.created_at,
    username: row.profile?.username ?? tStatic('relations.unavailable'),
    display_name: row.profile?.display_name ?? tStatic('relations.blockedAccount'),
    avatar_url: row.profile?.avatar_url ?? null,
  }));
}

/** Idempotent add for follow and mute. Blocks go through blockUser(). */
export async function addRelation(
  kind: Exclude<RelationKind, 'block'>,
  userId: string,
  targetId: string,
): Promise<void> {
  const { error } =
    kind === 'follow'
      ? await supabase
          .from('follows')
          .upsert({ follower_id: userId, following_id: targetId }, { ignoreDuplicates: true })
      : await supabase
          .from('mutes')
          .upsert({ muter_id: userId, muted_id: targetId }, { ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

/** Idempotent remove for any relation. */
export async function removeRelation(
  kind: RelationKind,
  userId: string,
  targetId: string,
): Promise<void> {
  const t = TABLES[kind];
  const { error } = await supabase
    .from(t.table)
    .delete()
    .eq(t.me, userId)
    .eq(t.them, targetId);
  if (error) throw new Error(error.message);
}

/**
 * Block someone. One database transaction: the block is recorded and any
 * follow or mute between the two people is removed in both directions.
 */
export async function blockUser(targetId: string): Promise<void> {
  const { error } = await supabase.rpc('block_user', { target: targetId });
  if (error) throw new Error(error.message);
}

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export const REPORT_REASONS: readonly { key: ReportReason; labelKey: TranslationKey }[] = [
  { key: 'spam', labelKey: 'report.reason.spam' },
  { key: 'harassment', labelKey: 'report.reason.harassment' },
  { key: 'inappropriate', labelKey: 'report.reason.inappropriate' },
  { key: 'other', labelKey: 'report.reason.other' },
];

interface ReportInput {
  /** The post being reported, if any. */
  postId?: string;
  /** The person being reported (the post's author when reporting a post). */
  userId: string;
  reason: ReportReason;
  details: string | null;
}

/** File a report. Reports are reviewed by the developer; users never see them. */
export async function submitReport(reporterId: string, input: ReportInput): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    post_id: input.postId ?? null,
    reported_user_id: input.userId,
    reason: input.reason,
    details: input.details,
  });
  if (error) throw new Error(error.message);
}

/**
 * Permanently delete the signed-in user's account and everything they made.
 * Runs in the `delete-account` Edge Function: it removes the user's photos
 * and then the auth user through the Auth Admin API, and every database row
 * cascades from there.
 */
export async function deleteMyAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
    'delete-account',
    { method: 'POST' },
  );
  if (error) throw new Error(error.message);
  if (!data?.ok) throw new Error(data?.error ?? tStatic('error.deleteAccount'));
}
