export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
}

export interface PostAuthor {
  username: string;
  display_name: string;
  avatar_url: string | null;
}

/** The post a fork branched from, as far as the reader is allowed to see it. */
export interface ForkOrigin {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
}

/** The day's prompt a post answered. Text in both languages; the UI picks one. */
export interface DailyPromptRef {
  id: string;
  prompt_date: string;
  text_en: string;
  text_ja: string;
}

/** A post as shown in the feed, with aggregates derived at query time. */
export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  /** First photo, kept for older clients; prefer image_urls. */
  image_url: string | null;
  /** Up to four photos, in the order the author chose. */
  image_urls: string[];
  created_at: string;
  author: PostAuthor;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  /** Set when this post branched from another (even if that one is now hidden). */
  forked_from_post_id: string | null;
  /** The original, when the reader can see it; null if deleted or blocked. */
  forked_from: ForkOrigin | null;
  /** Posts that branched from this one, counting only those the reader can see. */
  branch_count: number;
  /** The daily prompt this post answered, if any. */
  daily_prompt: DailyPromptRef | null;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  /** Null for a root comment; the root's id for a reply (one level only). */
  parent_comment_id: string | null;
  /** Set when a root comment with replies was deleted (a tombstone). */
  deleted_at: string | null;
  author: PostAuthor;
}
