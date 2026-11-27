import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { parseRef } from '@weyro/api-contracts';
import { Button, Chip, Input, StatusPill } from '@/components/ui';
import { useAdminLookup } from '@/hooks/useAdmin';
import { palette, radii, spacing, typography } from '@/theme';
import { formatRupees, titleize } from '@/utils/format';

/**
 * Find any request, quote, job, parts order, driver trip, payment or refund by its Weyro
 * reference number. The number is checked on the phone first (same formula as the server),
 * so a mistyped digit is caught before any request is made.
 */
export function RefSearch() {
  const [text, setText] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const lookup = useAdminLookup();
  const router = useRouter();

  const find = (value: string) => {
    const parsed = parseRef(value);
    if (!parsed) {
      lookup.reset();
      setLocalError('That is not a valid Weyro reference. Check the letters and numbers, like J-261127-0042-6.');
      return;
    }
    setLocalError(null);
    setText(parsed.ref);
    lookup.mutate(parsed.ref);
  };

  const result = lookup.data;
  const error = localError ?? (lookup.error as Error | null)?.message ?? null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <View style={styles.input}>
          <Input
            value={text}
            onChangeText={setText}
            placeholder="Reference, e.g. J-261127-0042-6"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => find(text)}
            accessibilityLabel="Reference number"
          />
        </View>
        <Button title="Find" variant="secondary" onPress={() => find(text)} loading={lookup.isPending} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {result && !error ? (
        <View style={styles.card} accessible accessibilityLabel={`${result.label} ${result.ref}, ${titleize(result.status)}`}>
          <View style={styles.head}>
            <Text style={styles.kind}>{result.label}</Text>
            <StatusPill label={titleize(result.status)} tone="neutral" />
          </View>
          <Text style={styles.ref} selectable>
            {result.ref}
          </Text>
          {result.title ? <Text style={styles.title}>{result.title}</Text> : null}
          <Text style={styles.meta}>
            {[
              result.amount !== null ? formatRupees(result.amount) : null,
              result.customer,
              result.provider,
              new Date(result.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
            ]
              .filter(Boolean)
              .join(', ')}
          </Text>
          {result.linked.length ? (
            <View style={styles.linked}>
              <Text style={styles.meta}>Linked</Text>
              <View style={styles.chips}>
                {result.linked.map((ref) => (
                  <Chip key={ref} label={ref} accessibilityLabel={`Open ${ref}`} onPress={() => find(ref)} />
                ))}
              </View>
            </View>
          ) : null}
          <Button
            title="Open full details"
            variant="secondary"
            onPress={() => router.push(`/admin-record/${result.ref}`)}
            style={styles.openButton}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  input: { flex: 1 },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.xs },
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kind: { ...typography.captionMedium, color: palette.textSecondary },
  ref: { ...typography.heading, color: palette.textPrimary, marginTop: spacing.xs, fontVariant: ['tabular-nums'] },
  title: { ...typography.body, color: palette.textPrimary, marginTop: 2 },
  meta: { ...typography.caption, color: palette.textMuted, marginTop: spacing.xs },
  linked: { marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  openButton: { marginTop: spacing.md },
});
