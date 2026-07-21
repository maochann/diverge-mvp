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

/** A post as shown in the feed, with aggregates derived at query time. */
export interface FeedPost {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author: PostAuthor;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  author: PostAuthor;
}
