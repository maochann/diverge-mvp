import { Alert, type ViewStyle } from 'react-native';

import { Button } from '@/components/button';
import { useT } from '@/i18n';
import { useRelations } from '@/lib/relations-context';
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
  const { sets, isFollowing, isPending, toggleFollow } = useRelations();
  const t = useT();
  const active = isFollowing(userId);

  const handlePress = async () => {
    try {
      await toggleFollow(userId);
    } catch (e) {
      Alert.alert(active ? t('follow.unfollowFailed') : t('follow.failed'), errorMessage(e));
    }
  };

  return (
    <Button
      title={active ? t('follow.following') : t('follow.follow')}
      variant={active ? 'outline' : 'primary'}
      compact
      // Until the set has loaded we can't know the state; keep the button quiet.
      disabled={sets === null || isPending(userId)}
      onPress={() => void handlePress()}
      style={style}
    />
  );
}
