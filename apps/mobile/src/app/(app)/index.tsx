import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/components/ui';
import { palette, spacing, typography } from '@/theme';

export default function HomeScreen() {
  return (
    <ScreenContainer>
      <View style={styles.center}>
        <Text style={styles.title}>Home / Dashboard</Text>
        <Text style={styles.subtitle}>Your overview will appear here</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: { ...typography.heading, color: palette.textPrimary },
  subtitle: { ...typography.body, color: palette.textSecondary, marginTop: spacing.xs },
});
