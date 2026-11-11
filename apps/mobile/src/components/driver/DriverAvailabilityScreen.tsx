import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  BackButton,
  Button,
  Chip,
  EmptyState,
  PressableScale,
  ScreenContainer,
  Skeleton,
} from '@/components/ui';
import {
  useDriverAvailability,
  useSaveDriverAvailability,
  type DriverAvailabilityRule,
} from '@/hooks/useDriverGo';
import { palette, spacing, typography } from '@/theme';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const PRESETS = [
  { label: 'Morning', startMinute: 8 * 60, endMinute: 14 * 60 },
  { label: 'Afternoon', startMinute: 14 * 60, endMinute: 20 * 60 },
  { label: 'Full day', startMinute: 8 * 60, endMinute: 20 * 60 },
];

type DayState = {
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

function initialState(rules: DriverAvailabilityRule[]) {
  const state: Record<number, DayState> = {};
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const rule = rules.find((item) => item.weekday === weekday);
    state[weekday] = rule
      ? {
          enabled: true,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
        }
      : { enabled: false, startMinute: 8 * 60, endMinute: 20 * 60 };
  }
  return state;
}

function timeLabel(minutes: number) {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function AvailabilityEditor({
  rules,
}: {
  rules: DriverAvailabilityRule[];
}) {
  const [days, setDays] = useState(() => initialState(rules));
  const [saved, setSaved] = useState(false);
  const save = useSaveDriverAvailability();

  const update = (weekday: number, patch: Partial<DayState>) => {
    setSaved(false);
    setDays((current) => ({
      ...current,
      [weekday]: { ...current[weekday], ...patch },
    }));
  };

  const onSave = async () => {
    const payload = Object.entries(days)
      .filter(([, value]) => value.enabled)
      .map(([weekday, value]) => ({
        weekday: Number(weekday),
        startMinute: value.startMinute,
        endMinute: value.endMinute,
      }));
    try {
      await save.mutateAsync(payload);
      setSaved(true);
    } catch {
      // The mutation error is shown below.
    }
  };

  return (
    <>
      <Text style={styles.intro}>
        Set the windows when you can accept Driver Go jobs. Scheduled bookings
        are matched against these hours.
      </Text>

      <View style={styles.list}>
        {DAYS.map((day, weekday) => {
          const value = days[weekday];
          return (
            <View key={day} style={styles.dayRow}>
              <View style={styles.dayHead}>
                <Text style={styles.dayLabel}>{day}</Text>
                <View style={styles.spacerFlex} />
                <PressableScale
                  onPress={() => update(weekday, { enabled: !value.enabled })}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: value.enabled }}
                  accessibilityLabel={`${day} availability`}
                  scaleTo={0.95}
                  style={[styles.dayToggle, value.enabled && styles.dayToggleOn]}
                >
                  <Text
                    style={[
                      styles.dayToggleText,
                      value.enabled && styles.dayToggleTextOn,
                    ]}
                  >
                    {value.enabled ? 'On' : 'Off'}
                  </Text>
                </PressableScale>
              </View>

              {value.enabled ? (
                <View style={styles.presetRow}>
                  {PRESETS.map((preset) => {
                    const selected =
                      value.startMinute === preset.startMinute &&
                      value.endMinute === preset.endMinute;
                    return (
                      <Chip
                        key={preset.label}
                        label={preset.label}
                        selected={selected}
                        onPress={() =>
                          update(weekday, {
                            startMinute: preset.startMinute,
                            endMinute: preset.endMinute,
                          })
                        }
                      />
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.offText}>Not available</Text>
              )}
              {value.enabled &&
              !PRESETS.some(
                (preset) =>
                  preset.startMinute === value.startMinute &&
                  preset.endMinute === value.endMinute,
              ) ? (
                <Text style={styles.custom}>
                  Current window {timeLabel(value.startMinute)}–
                  {timeLabel(value.endMinute)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {save.isError ? (
        <Text style={styles.error}>
          {(save.error as Error)?.message || 'Could not save availability.'}
        </Text>
      ) : null}
      {saved ? <Text style={styles.saved}>Availability saved.</Text> : null}

      <Button
        title="Save availability"
        onPress={() => void onSave()}
        loading={save.isPending}
        disabled={save.isPending}
        style={styles.save}
      />
    </>
  );
}

export function DriverAvailabilityScreen() {
  const query = useDriverAvailability();

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <View style={styles.topBar}>
        <BackButton />
        <Text style={styles.eyebrow}>AVAILABILITY</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>When can you drive?</Text>
        {query.isLoading ? (
          <View style={{ marginTop: spacing.lg }}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton
                key={i}
                width="100%"
                height={64}
                style={{ marginBottom: spacing.sm }}
              />
            ))}
          </View>
        ) : query.isError || !query.data ? (
          <EmptyState
            title="Availability unavailable"
            message="Check your connection and try again."
          />
        ) : (
          <AvailabilityEditor rules={query.data.rules} />
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    letterSpacing: 2,
  },
  spacer: { width: 44 },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { ...typography.title, color: palette.textPrimary },
  intro: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.xs,
  },
  list: { marginTop: spacing.lg },
  dayRow: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  spacerFlex: { flex: 1 },
  dayLabel: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    width: 38,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  offText: { ...typography.caption, color: palette.textMuted },
  dayToggle: {
    minHeight: 34,
    minWidth: 54,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
  },
  dayToggleOn: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  dayToggleText: { ...typography.label, color: palette.textSecondary },
  dayToggleTextOn: { color: palette.accent },
  custom: {
    ...typography.caption,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  error: { ...typography.caption, color: palette.danger, marginTop: spacing.md },
  saved: { ...typography.caption, color: palette.accent, marginTop: spacing.md },
  save: { marginTop: spacing.lg },
});
