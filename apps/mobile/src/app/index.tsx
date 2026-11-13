import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { palette } from '@/theme';

/**
 * `/` resolves the entry stack once auth bootstrap completes. Navigation is
 * performed after mount rather than during render: a render-time Redirect
 * here loops against the declarative auth guards in the root Stack.
 */
export default function Index() {
  // The root layout redirects once auth bootstrap resolves; this route only
  // paints a calm loading surface during that decision.
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={palette.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.canvas,
  },
});
