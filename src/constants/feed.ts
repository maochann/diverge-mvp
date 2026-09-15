/**
 * Finite Feed: the feed is read in chapters of a fixed number of posts.
 * Nothing loads past the end of a chapter unless the reader asks for more.
 */
export const CHAPTER_SIZE = 12;

/**
 * Mix it up: how a chapter is split between people the reader follows and
 * people they don't. Either side fills in for the other when it runs short,
 * so a chapter is still CHAPTER_SIZE posts whenever that many exist.
 */
export const MIX_FOLLOWED_COUNT = 8;
export const MIX_OUTSIDE_COUNT = 4;

/**
 * Feed Intent: the reader declares what they want from the feed. The only
 * inputs to what they see are this choice and who they follow — never likes,
 * follower counts, or how long they looked at something.
 */
export type FeedIntent = 'catch_up' | 'mix_it_up' | 'explore';

export const DEFAULT_FEED_INTENT: FeedIntent = 'catch_up';

export interface FeedIntentOption {
  key: FeedIntent;
  label: string;
  description: string;
}

export const FEED_INTENTS: readonly FeedIntentOption[] = [
  {
    key: 'catch_up',
    label: 'Catch up',
    description: 'People you follow, newest first.',
  },
  {
    key: 'mix_it_up',
    label: 'Mix it up',
    description: 'Mostly your circle, with a few voices from outside it.',
  },
  {
    key: 'explore',
    label: 'Explore',
    description: 'One post from everyone outside your circle, then more.',
  },
];

export function isFeedIntent(value: unknown): value is FeedIntent {
  return FEED_INTENTS.some((o) => o.key === value);
}
