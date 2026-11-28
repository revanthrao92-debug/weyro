import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import type { AdminActivityStats } from '@/hooks/useAdmin';
import { haptics } from '@/lib/haptics';
import { palette, spacing, typography } from '@/theme';

type Day = AdminActivityStats['days'][number];

const total = (d: Day) => d.requests + d.quotations + d.bookings + d.sparePartOrders;
const dayName = (date: string, style: 'short' | 'long') =>
  new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-IN', {
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/**
 * Last 7 days of platform activity: one bar per day (today in the accent colour).
 * Touch or drag along it to read a day's breakdown above the chart.
 */
export function ActivityChart({ days }: { days: Day[] }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const height = 120;
  const labelH = 20;
  const plotH = height - labelH;
  const slot = days.length ? width / days.length : 0;
  const max = Math.max(1, ...days.map(total));
  const week = days.reduce((sum, d) => sum + total(d), 0);

  const pick = (x: number) => {
    if (!slot) return;
    const i = Math.min(days.length - 1, Math.max(0, Math.floor(x / slot)));
    if (i !== active) {
      haptics.tick();
      setActive(i);
    }
  };

  const shown = active !== null ? days[active] : null;
  const readout = shown
    ? {
        label: dayName(shown.date, 'long'),
        value: `${total(shown)} event${total(shown) === 1 ? '' : 's'}`,
        meta: `${shown.requests} requests, ${shown.quotations} quotes, ${shown.bookings} jobs, ${shown.sparePartOrders} parts orders`,
      }
    : { label: 'Last 7 days', value: `${week} event${week === 1 ? '' : 's'}`, meta: 'Touch a day to see what happened' };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Platform activity, last 7 days: ${days.map((d) => `${dayName(d.date, 'short')} ${total(d)}`).join(', ')}`}
    >
      <View style={styles.readout}>
        <Text style={styles.readLabel}>{readout.label}</Text>
        <Text style={styles.readValue}>{readout.value}</Text>
        <Text style={styles.readMeta}>{readout.meta}</Text>
      </View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {days.map((d, i) => {
              const barW = Math.max(4, slot - spacing.sm);
              const h = Math.max(2, (total(d) / max) * (plotH - 4));
              const isToday = i === days.length - 1;
              const dim = active !== null && active !== i;
              return (
                <Rect
                  key={d.date}
                  x={i * slot + (slot - barW) / 2}
                  y={plotH - h}
                  width={barW}
                  height={h}
                  rx={3}
                  fill={isToday ? palette.accent : palette.textMuted}
                  fillOpacity={dim ? 0.25 : isToday ? 1 : 0.5}
                />
              );
            })}
            {days.map((d, i) => (
              <SvgText
                key={`l-${d.date}`}
                x={i * slot + slot / 2}
                y={height - 4}
                fontSize={12}
                fill={palette.textMuted}
                textAnchor="middle"
              >
                {new Date(`${d.date}T00:00:00.000Z`).toLocaleDateString('en-IN', { weekday: 'narrow', timeZone: 'UTC' })}
              </SvgText>
            ))}
          </Svg>
        ) : null}
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderTerminationRequest={() => false}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
          onResponderMove={(e) => pick(e.nativeEvent.locationX)}
          onResponderRelease={() => setActive(null)}
          onResponderTerminate={() => setActive(null)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { minHeight: 68, marginBottom: spacing.sm },
  readLabel: { ...typography.caption, color: palette.textMuted },
  readValue: { ...typography.title, color: palette.textPrimary, marginTop: 2, fontVariant: ['tabular-nums'] },
  readMeta: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
});
