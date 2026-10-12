import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';

import { lastTab } from '@/lib/last-tab';
import { useTheme } from '@/lib/theme';

/**
 * The Post tab has no screen of its own. Selecting it raises the composer
 * as a sheet over the place the reader was in; when the sheet closes, the
 * tab bar goes back to that place. (Native tab presses can't be intercepted,
 * so this empty screen does the redirect.)
 */
export default function CreateTab() {
  const { colors } = useTheme();
  const raised = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (raised.current) {
        // Back from the sheet: return to where the reader was.
        raised.current = false;
        router.navigate(lastTab());
        return;
      }
      raised.current = true;
      router.push('/compose');
    }, []),
  );

  return <View style={{ flex: 1, backgroundColor: colors.background }} />;
}
