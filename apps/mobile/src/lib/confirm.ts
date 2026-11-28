import { Alert, Platform } from 'react-native';

/**
 * "Are you sure?" that works on phones and in a browser (Alert.alert shows
 * nothing on web, so a confirm built on it silently never confirms there).
 */
export function confirmAction(title: string, message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

/** A message with an OK button, on phones and in a browser (for errors that must not go unseen). */
export function notice(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
