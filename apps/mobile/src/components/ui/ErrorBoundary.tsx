import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, typography, displayFamily } from '@/theme';
import { captureError } from '@/lib/sentry';

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Last-resort UI boundary. A render error must never leave the app on a blank
 * screen with no way back into the session.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) {
      console.error('Unhandled UI error', error, info.componentStack);
    }
    // No-op unless Sentry is configured; the event is scrubbed before sending.
    captureError(error, { boundary: 'root' });
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.root}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The screen hit an unexpected error. Your session is still signed in.
        </Text>
        {__DEV__ ? (
          <Text style={styles.reason} numberOfLines={4}>
            {this.state.error.message}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={() => this.setState({ error: null })}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: palette.canvas,
  },
  title: {
    fontFamily: displayFamily,
    fontSize: 24,
    color: palette.textPrimary,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  reason: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xl,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  buttonText: { ...typography.bodyMedium, color: palette.onAccent },
});
