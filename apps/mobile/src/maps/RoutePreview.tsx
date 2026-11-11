import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { AlertTriangle, Route } from 'lucide-react-native';
import { MapSurface } from './MapSurface';
import { hasMapAccess } from './config';
import { reverseGeocode } from './client';
import { centerOf, fitZoom, formatDistance, formatDuration } from './geo';
import { useDirections } from './useDirections';
import type { PickedLocation } from './types';
import {
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

export type RoutePreviewProps = {
  from: PickedLocation | null;
  to: PickedLocation | null;
  onChange: (which: 'from' | 'to', location: PickedLocation) => void;
  height?: number;
};

/**
 * Pickup + destination with the driving route, distance and ETA. Both pins are
 * draggable; dropping a pin re-resolves its address.
 */
export function RoutePreview({
  from,
  to,
  onChange,
  height = 176,
}: RoutePreviewProps) {
  const [width, setWidth] = useState(0);
  const { route, loading, error } = useDirections(from, to);

  if (!hasMapAccess) return null;

  const points = [from, to].filter(Boolean) as PickedLocation[];
  const center =
    points.length > 0 ? centerOf(points) : { latitude: 12.9716, longitude: 77.5946 };
  const zoom = fitZoom(points, width, height, 48);

  const onLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next !== width) setWidth(next);
  };

  const dropPin = async (which: 'from' | 'to', latitude: number, longitude: number) => {
    onChange(which, {
      address: 'Dropped pin',
      latitude,
      longitude,
      label: 'Adjusting…',
    });
    try {
      const place = await reverseGeocode({ latitude, longitude });
      if (place) {
        onChange(which, {
          address: place.address,
          latitude,
          longitude,
          label: place.name,
        });
      }
    } catch {
      // Keep the dropped-pin label; the customer can still edit it by tapping.
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={[styles.mapFrame, { height }]} onLayout={onLayout}>
        <MapSurface
          center={center}
          zoom={zoom}
          route={route?.geometry ?? null}
          markers={[
            ...(from
              ? [
                  {
                    id: 'from',
                    coordinate: {
                      latitude: from.latitude,
                      longitude: from.longitude,
                    },
                    kind: 'pickup' as const,
                    draggable: true,
                    label: 'Pickup point',
                  },
                ]
              : []),
            ...(to
              ? [
                  {
                    id: 'to',
                    coordinate: { latitude: to.latitude, longitude: to.longitude },
                    kind: 'dropoff' as const,
                    draggable: true,
                    label: 'Destination',
                  },
                ]
              : []),
          ]}
          onMarkerDragEnd={(id, coordinate) =>
            void dropPin(
              id === 'to' ? 'to' : 'from',
              coordinate.latitude,
              coordinate.longitude,
            )
          }
          interactive={points.length > 1}
          showZoomControls={false}
          style={styles.map}
        />
      </View>

      <View style={styles.summary}>
        {loading ? (
          <View style={styles.summaryRow}>
            <ActivityIndicator size="small" color={palette.textMuted} />
            <Text style={styles.summaryMuted}>Calculating route…</Text>
          </View>
        ) : route ? (
          <>
            <View style={styles.summaryRow}>
              <Route size={14} color={palette.accent} strokeWidth={2} />
              <Text style={styles.summaryStrong}>
                {formatDistance(route.distanceM)}
              </Text>
              <Text style={styles.summaryDot}>·</Text>
              <Text style={styles.summaryStrong}>
                {formatDuration(route.durationS)}
              </Text>
              <Text style={styles.summaryMuted}>driving</Text>
            </View>
            <Text style={styles.summaryHint}>
              Estimate only — tolls and live traffic are not included.
            </Text>
          </>
        ) : error ? (
          <View style={styles.summaryRow}>
            <AlertTriangle size={14} color={palette.warning} strokeWidth={2} />
            <Text style={styles.summaryMuted} numberOfLines={2}>
              {error}
            </Text>
          </View>
        ) : (
          <Text style={styles.summaryMuted}>
            Set both points to see the distance and ETA.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  mapFrame: {
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  map: { flex: 1 },
  summary: { gap: 2, paddingTop: 2 },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryStrong: {
    fontFamily: fontFamilyMono,
    fontSize: 12,
    color: palette.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  summaryMuted: {
    ...typography.caption,
    color: palette.textMuted,
  },
  summaryDot: { color: palette.textMuted, fontSize: 11 },
  summaryHint: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
  },
});
