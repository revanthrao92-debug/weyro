import React from 'react';
import { StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface EmptyListCardProps {
  title: string;
  subtitle: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyListCard({
  title,
  subtitle,
  actionText,
  onAction,
}: EmptyListCardProps) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <ThemedText style={styles.title}>{title}</ThemedText>
      <ThemedText style={styles.subtitle} themeColor="textSecondary">
        {subtitle}
      </ThemedText>
      {Boolean(actionText && onAction) && (
        <Pressable
          onPress={onAction}
          style={[styles.btn, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.btnText}>{actionText}</ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.four,
    alignItems: 'center',
    marginVertical: Spacing.two,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.three,
  },
  btn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
