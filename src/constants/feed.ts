/**
 * Finite Feed: the feed is read in chapters of a fixed number of posts.
 * Nothing loads past the end of a chapter unless the reader asks for more.
 */
export const CHAPTER_SIZE = 12;

/**
 * Feed Intent: the reader declares what they want from the feed before the
 * app infers anything from their behaviour. Today every intent returns the
 * same reverse-chronological feed; the choice is the seam where ranking will
 * attach once there are enough people for it to mean something.
 */
export type FeedIntent = 'catch_up' | 'mix_it_up' | 'explore';

export const DEFAULT_FEED_INTENT: FeedIntent = 'catch_up';

export interface FeedIntentOption {
  key: FeedIntent;
  label: string;
  description: string;
  /** True while the intent has no effect on what is shown. */
  placeholder: boolean;
}

export const FEED_INTENTS: readonly FeedIntentOption[] = [
  {
    key: 'catch_up',
    label: 'Catch up',
    description: 'Newest posts from everyone, in order.',
    placeholder: false,
  },
  {
    key: 'mix_it_up',
    label: 'Mix it up',
    description: 'A few voices you don’t usually see.',
    placeholder: true,
  },
  {
    key: 'explore',
    label: 'Explore',
    description: 'Further out from your usual circle.',
    placeholder: true,
  },
];

export function isFeedIntent(value: unknown): value is FeedIntent {
  return FEED_INTENTS.some((o) => o.key === value);
}
