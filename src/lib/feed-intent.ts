import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_FEED_INTENT, isFeedIntent, type FeedIntent } from '@/constants/feed';

const storageKey = (userId: string) => `feed-intent:${userId}`;

interface StoredIntent {
  userId: string;
  intent: FeedIntent;
}

/**
 * The reader's current feed intent, remembered per account on this device.
 * `ready` is false until the stored value has been read, so the first feed
 * request can carry the right intent.
 */
export function useFeedIntent(userId: string) {
  const [loaded, setLoaded] = useState<StoredIntent | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(storageKey(userId))
      .then((stored) => {
        if (cancelled) return;
        setLoaded({ userId, intent: isFeedIntent(stored) ? stored : DEFAULT_FEED_INTENT });
      })
      .catch(() => {
        // Storage is a convenience; the default intent is always valid.
        if (!cancelled) setLoaded({ userId, intent: DEFAULT_FEED_INTENT });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setIntent = useCallback(
    (next: FeedIntent) => {
      setLoaded({ userId, intent: next });
      AsyncStorage.setItem(storageKey(userId), next).catch(() => undefined);
    },
    [userId],
  );

  // Derived: a value only counts once it belongs to the current account.
  const ready = loaded?.userId === userId;
  const intent = ready ? loaded.intent : DEFAULT_FEED_INTENT;
  return { intent, setIntent, ready };
}
