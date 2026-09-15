import { Alert, type ViewStyle } from 'react-native';

import { Button } from '@/components/button';
import { useFollows } from '@/lib/follow-context';
import { errorMessage } from '@/lib/supabase';

interface FollowButtonProps {
  userId: string;
  style?: ViewStyle;
}

/**
 * Follow / Following toggle for one person. Following is an explicit choice,
 * so the button lives only where the whole person is visible (their profile,
 * the Following list) — never next to a single post.
 */
export function FollowButton({ userId, style }: FollowButtonProps) {
  const { following, isFollowing, isPending, toggleFollow } = useFollows();
  const active = isFollowing(userId);

  const handlePress = async () => {
    try {
      await toggleFollow(userId);
    } catch (e) {
      Alert.alert(active ? 'Could not unfollow' : 'Could not follow', errorMessage(e));
    }
  };

  return (
    <Button
      title={active ? 'Following' : 'Follow'}
      variant={active ? 'outline' : 'primary'}
      compact
      // Until the set has loaded we can't know the state; keep the button quiet.
      disabled={following === null || isPending(userId)}
      onPress={() => void handlePress()}
      style={style}
    />
  );
}
