import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useT } from '@/i18n';
import { useTheme } from '@/lib/theme';

/**
 * The system tab bar (Liquid Glass on iOS 26: a floating pill that
 * recedes as you scroll, drawn by the OS). Three places, as before, but the
 * screens carry no title bar of their own; what you see is the content.
 * The Post tab is a doorway: its screen immediately raises the composer
 * as a sheet (see create.tsx) so writing never replaces the place you were.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const t = useT();
  return (
    <NativeTabs minimizeBehavior="onScrollDown" tintColor={colors.tint}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} />
        <NativeTabs.Trigger.Label>{t('tab.feed')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="create" disableScrollToTop>
        <NativeTabs.Trigger.Icon sf="square.and.pencil" />
        <NativeTabs.Trigger.Label>{t('tab.post')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <NativeTabs.Trigger.Label>{t('tab.profile')}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
