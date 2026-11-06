import { View, Text, StyleSheet } from 'react-native';
import { palette, displayFamily } from '@/theme';

/** Brand mark: orange "V" glyph + lowercase "weyro" wordmark. */
export function BrandMark({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const markSize = size === 'md' ? 24 : 18;
  const wordSize = size === 'md' ? 22 : 16;
  return (
    <View style={styles.row}>
      <Text style={[styles.mark, { fontSize: markSize }]}>V</Text>
      <Text style={[styles.word, { fontSize: wordSize }]}>weyro</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mark: {
    fontFamily: displayFamily,
    color: palette.accent,
    fontWeight: '700',
  },
  word: {
    fontFamily: displayFamily,
    color: palette.textPrimary,
    letterSpacing: 0.5,
  },
});
