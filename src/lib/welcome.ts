import AsyncStorage from '@react-native-async-storage/async-storage';

/** Device-wide: the first-launch tour has been seen (or skipped) once. */
const KEY = 'welcome-seen';

export async function hasSeenWelcome(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return true;
  }
}

export async function markWelcomeSeen(): Promise<void> {
  await AsyncStorage.setItem(KEY, '1').catch(() => undefined);
}
