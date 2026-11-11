import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { SectionHead } from '@/components/ui';
import { RoutePreview } from '@/maps';
import type { UploadedImage } from '@/services/uploads';
import type { Vehicle } from '@/hooks/useProfile';
import {
  composeTitle,
  displayFieldValue,
  effectiveLocationFor,
  urgencyLabel,
  type DraftContext,
  type ServiceConfig,
} from './serviceRequestConfig';
import { fontFamilyMono, palette, spacing, typography } from '@/theme';

export type RequestReviewProps = {
  config: ServiceConfig;
  ctx: DraftContext;
  photos: UploadedImage[];
  contact: { name: string; detail: string };
  onEdit: (step: 1 | 2) => void;
  onChangePickup: (location: DraftContext['location']) => void;
  onChangeDropoff: (location: DraftContext['location']) => void;
};

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function PlaceRow({
  label,
  place,
}: {
  label: string;
  place: DraftContext['location'];
}) {
  if (!place) return null;
  return (
    <View style={styles.placeRow}>
      <View style={styles.placeIcon}>
        <MapPin size={14} color={palette.accent} strokeWidth={2} />
      </View>
      <View style={styles.placeText}>
        <Text style={styles.placeLabel}>{label}</Text>
        <Text style={styles.placeAddress}>{place.address}</Text>
      </View>
    </View>
  );
}

function vehicleSummary(vehicle: Vehicle | null, ctx: DraftContext): string {
  if (vehicle) {
    return `${vehicle.make} ${vehicle.model} · ${vehicle.year} · ${vehicle.registrationNumber}`;
  }
  const { make, model, year } = ctx.manualVehicle;
  return [make, model, year].filter(Boolean).join(' ');
}

export function RequestReview({
  config,
  ctx,
  photos,
  contact,
  onEdit,
  onChangePickup,
  onChangeDropoff,
}: RequestReviewProps) {
  const pickup = effectiveLocationFor(config, ctx);
  const rows = config.fields
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: displayFieldValue(field, ctx.values[field.key]),
    }))
    .filter((row) => row.value);

  const showUrgency = config.urgencyMode !== 'none';

  return (
    <View>
      <Text style={styles.eyebrow}>Ready to send</Text>
      <Text style={styles.title}>{composeTitle(config, ctx)}</Text>
      <Text style={styles.subtitle}>
        {config.label} · {urgencyLabel(ctx.urgency)}
      </Text>

      <SectionHead index="01" title="Details" action="Edit" onAction={() => onEdit(1)} />
      {rows.map((row) => (
        <Row key={row.key} label={row.label} value={row.value} />
      ))}

      <SectionHead index="02" title="Vehicle" action="Edit" onAction={() => onEdit(2)} />
      <Row
        label="Vehicle"
        value={vehicleSummary(ctx.selectedVehicle, ctx)}
      />
      {ctx.selectedVehicle ? null : (
        <Row label="Note" value="Added to your garage with this request" />
      )}

      <SectionHead
        index="03"
        title={config.locationMode === 'trip' ? 'Route' : 'Location'}
        action="Edit"
        onAction={() => onEdit(2)}
      />
      {config.locationMode === 'trip' ? (
        <>
          <PlaceRow label="Pickup" place={pickup} />
          <PlaceRow label="Destination" place={ctx.dropoff} />
          {pickup && ctx.dropoff ? (
            <View style={styles.route}>
              <RoutePreview
                from={pickup}
                to={ctx.dropoff}
                onChange={(which, next) =>
                  which === 'from' ? onChangePickup(next) : onChangeDropoff(next)
                }
              />
            </View>
          ) : null}
        </>
      ) : config.category === 'SPARE_PART' &&
        ctx.spareFulfillment === 'PICKUP' ? (
        <PlaceRow label="Dealer pickup near" place={pickup} />
      ) : (
        <PlaceRow
          label={
            config.category === 'SPARE_PART' ? 'Delivery address' : config.locationLabel
          }
          place={pickup}
        />
      )}

      {photos.length > 0 ? (
        <>
          <SectionHead
            index="04"
            title={config.photos?.label ?? 'Photos'}
            action="Edit"
            onAction={() => onEdit(1)}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photos}
          >
            {photos.map((photo) => (
              <Image
                key={photo.url}
                source={{ uri: photo.url }}
                style={styles.photo}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        </>
      ) : null}

      <SectionHead
        index={photos.length > 0 ? '05' : '04'}
        title="Dispatch"
        action="Edit"
        onAction={() => onEdit(2)}
      />
      {showUrgency ? <Row label="Urgency" value={urgencyLabel(ctx.urgency)} /> : null}
      {config.category === 'SPARE_PART' ? (
        <Row
          label="Fulfilment"
          value={ctx.spareFulfillment === 'DELIVERY' ? 'Delivery' : 'Dealer pickup'}
        />
      ) : null}
      <Row label="Broadcast" value={ctx.isBroadcast ? 'On' : 'Off'} />
      <Row label="Contact" value={contact.name} />
      <Row label="Phone / email" value={contact.detail} />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...typography.label,
    color: palette.accent,
    marginTop: spacing.lg,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.title,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontFamily: fontFamilyMono,
    fontSize: 11,
    color: palette.textMuted,
    marginTop: spacing.xs,
  },
  row: {
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  rowLabel: {
    ...typography.label,
    color: palette.textMuted,
    marginBottom: 3,
  },
  rowValue: {
    ...typography.body,
    color: palette.textPrimary,
  },
  placeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  placeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoftBg,
  },
  placeText: { flex: 1 },
  placeLabel: { ...typography.label, color: palette.textMuted },
  placeAddress: {
    ...typography.body,
    color: palette.textPrimary,
    marginTop: 2,
  },
  route: { marginTop: spacing.md },
  photos: { gap: spacing.sm, paddingVertical: spacing.sm },
  photo: {
    width: 78,
    height: 78,
    borderRadius: 8,
    backgroundColor: palette.surfaceAlt,
  },
});
