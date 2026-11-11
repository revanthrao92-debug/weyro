import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  EmptyState,
  ScreenContainer,
  SectionHead,
  Skeleton,
} from '@/components/ui';
import { useDriverEarnings } from '@/hooks/useDriverGo';
import { DriverJobCard } from './DriverJobCard';
import { money } from './driverFormat';
import {
  fontFamilyMono,
  palette,
  spacing,
  typography,
} from '@/theme';

function Total({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.total}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={styles.totalValue}>{money(value)}</Text>
    </View>
  );
}

export function DriverEarningsScreen() {
  const router = useRouter();
  const query = useDriverEarnings();
  const data = query.data;

  return (
    <ScreenContainer chrome="dark" safeBottom>
      <AppHeader title="Earnings" subtitle="Driver Go payouts" />
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        {query.isLoading ? (
          <>
            <Skeleton width="100%" height={100} />
            <Skeleton width="100%" height={150} style={{ marginTop: spacing.md }} />
          </>
        ) : query.isError || !data ? (
          <EmptyState
            title="Earnings unavailable"
            message="Check your connection and try again."
          />
        ) : (
          <>
            <View style={styles.totals}>
              <Total label="Today" value={data.today} />
              <Total label="This week" value={data.week} />
              <Total label="This month" value={data.month} />
            </View>

            <Text style={styles.note}>
              Earnings are net of the 18% platform fee. Payouts are released
              weekly by the Weyro team during the pilot.
            </Text>

            <SectionHead index="01" title="Completed trips" />
            {data.trips.length === 0 ? (
              <EmptyState
                title="No completed trips yet"
                message="Completed Driver Go trips will appear here with their payout."
              />
            ) : (
              data.trips.map((job) => (
                <DriverJobCard
                  key={job.id}
                  job={job}
                  onPress={() => router.push(`/driver-booking/${job.id}`)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  totals: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  total: { flex: 1, gap: 3 },
  totalLabel: {
    ...typography.label,
    color: palette.textMuted,
  },
  totalValue: {
    fontFamily: fontFamilyMono,
    fontSize: 18,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  note: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.md,
  },
});
