import { StyleSheet, Text, View } from 'react-native';
import { palette, radii, typography } from '@/theme';

export interface AvatarProps {
  /** Name used to derive initials and the accessibility label. */
  name?: string;
  /** Optional image URL — not rendered here (kept for API compatibility). */
  uri?: string;
  size?: number;
}

/**
 * Initials avatar. Falls back to a neutral monogram when no image is supplied.
 * (No image loading dependency added; a themed placeholder keeps it consistent.)
 */
export function Avatar({ name, size = 40 }: AvatarProps) {
  const initials = getInitials(name);
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="image"
      accessibilityLabel={name ? `${name}` : 'Avatar'}
    >
      <Text style={[styles.initials, { fontSize: size * 0.4 }]} maxFontSizeMultiplier={2}>
        {initials}
      </Text>
    </View>
  );
}

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: palette.accentSoftBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  initials: {
    ...typography.label,
    color: palette.accent,
    fontWeight: '600',
  },
});

export default Avatar;
