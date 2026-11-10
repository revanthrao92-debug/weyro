import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { Booking } from '@/hooks/useBookings';
import { StatusPill } from '@/components/ui';
import { photoForCategory, photo } from '@/lib/photos';
import { humanizeKey as labelize, bookingStatusTone as statusTone } from '@/utils/format';
import { palette, spacing, radii, typography } from '@/theme';

export type BookingCardProps = {
  booking: Booking;
  onPress: (id: string) => void;
};




/**
 * BookingCard — reference photo 6: photo-backed header, firm bordered body,
 * labeled rows, single status pill. "Rigid" = hairline borders, divider
 * lines, uppercase micro-labels, no floating softness.
 */
export function BookingCard({ booking, onPress }: BookingCardProps) {
  const category = (booking as { category?: string }).category;
  const imageSource = photo(photoForCategory(category));

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(booking.id)}
      accessibilityRole="button"
      accessibilityLabel={`Booking ${booking.id.slice(0, 8)}, ${labelize(booking.status)}`}
      activeOpacity={0.9}
    >
      {/* Photo header strip */}
      <View style={styles.photoHeader}>
        <Image source={{ uri: imageSource }} style={styles.photo} contentFit="cover" />
        <View style={styles.photoShade} />
        <View style={styles.photoInner}>
          <Text style={styles.photoTitle} maxFontSizeMultiplier={2} numberOfLines={1}>
            {booking.provider?.businessName ?? 'Booking'}
          </Text>
          <StatusPill label={labelize(booking.status)} tone={statusTone(booking.status)} />
        </View>
      </View>

      {/* Structured body */}
      <View style={styles.body}>
        {booking.provider ? (
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.label} maxFontSizeMultiplier={2}>PROVIDER</Text>
            <Text style={styles.value} maxFontSizeMultiplier={2} numberOfLines={1}>
              {booking.provider.businessName}
            </Text>
          </View>
        ) : null}

        {booking.payment ? (
          <View style={[styles.row, styles.rowDivider]}>
            <Text style={styles.label} maxFontSizeMultiplier={2}>AMOUNT</Text>
            <View style={styles.amountCol}>
              <Text style={styles.amount} maxFontSizeMultiplier={2}>
                ₹{booking.payment.amount.toLocaleString()}
              </Text>
              <StatusPill
                label={labelize(booking.payment.status)}
                tone={statusTone(booking.payment.status)}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.row}>
          <Text style={styles.label} maxFontSizeMultiplier={2}>BOOKING ID</Text>
          <View style={styles.idRow}>
            <Text style={styles.value} maxFontSizeMultiplier={2}>#{booking.id.slice(0, 8)}</Text>
            <ChevronRight size={16} color={palette.textMuted} strokeWidth={2} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderStrong,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  photoHeader: {
    height: 76,
    justifyContent: 'flex-end',
  },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  photoShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: palette.scrimStrong,
  },
  photoInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  photoTitle: {
    ...typography.heading,
    color: palette.onHeader,
    flexShrink: 1,
  },
  body: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: palette.border },
  label: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 0.5,
  },
  value: { ...typography.captionMedium, color: palette.textPrimary, flexShrink: 1 },
  amountCol: { alignItems: 'flex-end', gap: 2 },
  amount: { ...typography.bodyMedium, color: palette.textPrimary },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
