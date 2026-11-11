/* eslint-disable react-hooks/immutability, react-hooks/refs --
   Reanimated shared values are mutable by design, and gesture callbacks are
   worklets executed off the render path, not during render. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { MapPinOff, Minus, Plus } from 'lucide-react-native';
import {
  MAX_ZOOM,
  MIN_ZOOM,
  MAP_STYLE,
  MAPBOX_TOKEN,
  hasMapAccess,
} from './config';
import { TILE_SIZE, clamp, project, simplifyRoute, type LatLng } from './geo';
import { offsetCoordinate, unproject } from './geo';
import type { MapMarkerKind } from './types';
import { fontFamilyMono, palette, radii, spacing, typography } from '@/theme';

export type MapSurfaceMarker = {
  id: string;
  coordinate: LatLng;
  kind?: MapMarkerKind;
  draggable?: boolean;
  label?: string;
};

export type MapSurfaceProps = {
  center: LatLng;
  zoom: number;
  onCenterChange?: (coordinate: LatLng) => void;
  onZoomChange?: (zoom: number) => void;
  markers?: MapSurfaceMarker[];
  onMarkerDragEnd?: (id: string, coordinate: LatLng) => void;
  route?: LatLng[] | null;
  showCenterPin?: boolean;
  interactive?: boolean;
  showZoomControls?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

const tileUrl = (z: number, x: number, y: number) =>
  `https://api.mapbox.com/styles/v1/${MAP_STYLE}/tiles/256/${z}/${x}/${y}@2x?access_token=${MAPBOX_TOKEN}`;

const MARKER_WIDTH = 26;
const MARKER_HEIGHT = 34;

function PinGlyph({ color = palette.accent }: { color?: string }) {
  return (
    <Svg width={MARKER_WIDTH} height={MARKER_HEIGHT} viewBox="0 0 26 34">
      <Path
        d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z"
        fill={color}
      />
      <Circle cx={13} cy={12.6} r={4.6} fill={palette.canvas} />
    </Svg>
  );
}

function DraggableMarker({
  marker,
  x,
  y,
  zoom,
  onDragEnd,
}: {
  marker: MapSurfaceMarker;
  x: number;
  y: number;
  zoom: number;
  onDragEnd: (id: string, coordinate: LatLng) => void;
}) {
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value },
      { scale: dragX.value !== 0 || dragY.value !== 0 ? 1.08 : 1 },
    ],
  }));

  const commit = (latitude: number, longitude: number, dx: number, dy: number) => {
    onDragEnd(
      marker.id,
      offsetCoordinate({ latitude, longitude }, dx, dy, zoom),
    );
  };

  const gesture = Gesture.Pan()
    .enabled(Boolean(marker.draggable))
    .minDistance(0)
    .onStart(() => {
      dragX.value = 0;
      dragY.value = 0;
    })
    .onUpdate((event) => {
      dragX.value = event.translationX;
      dragY.value = event.translationY;
    })
    .onEnd((event) => {
      const dx = event.translationX;
      const dy = event.translationY;
      dragX.value = 0;
      dragY.value = 0;
      runOnJS(commit)(
        marker.coordinate.latitude,
        marker.coordinate.longitude,
        dx,
        dy,
      );
    });

  const color =
    marker.kind === 'dropoff' ? palette.textPrimary : palette.accent;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.marker,
          { left: x - MARKER_WIDTH / 2, top: y - MARKER_HEIGHT },
          animatedStyle,
        ]}
        accessibilityLabel={marker.label}
      >
        <PinGlyph color={color} />
        {marker.draggable ? <View style={styles.markerGrip} /> : null}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Raster map surface driven by Mapbox styles. Pan/pinch are transformed on the
 * UI thread so dragging stays smooth; tile grids are only rebuilt when a
 * gesture settles. No native map SDK, no per-frame React renders.
 */
export function MapSurface({
  center,
  zoom,
  onCenterChange,
  onZoomChange,
  markers = [],
  onMarkerDragEnd,
  route,
  showCenterPin = false,
  interactive = true,
  showZoomControls = false,
  style,
  children,
}: MapSurfaceProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const pinchScale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const lastCommitted = useRef<string | null>(null);

  const roundedZoom = clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM);
  const centerLatitude = center.latitude;
  const centerLongitude = center.longitude;

  const layers = useMemo(() => {
    if (!hasMapAccess || size.width <= 0 || size.height <= 0) return null;

    const centrePx = project(
      { latitude: centerLatitude, longitude: centerLongitude },
      roundedZoom,
    );
    const topLeft = {
      x: centrePx.x - size.width / 2,
      y: centrePx.y - size.height / 2,
    };
    const tileCount = 2 ** roundedZoom;
    const minX = Math.floor(topLeft.x / TILE_SIZE);
    const maxX = Math.floor((topLeft.x + size.width) / TILE_SIZE);
    const minY = Math.floor(topLeft.y / TILE_SIZE);
    const maxY = Math.floor((topLeft.y + size.height) / TILE_SIZE);

    const tiles: { key: string; uri: string; left: number; top: number }[] = [];
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (y < 0 || y >= tileCount) continue;
        const wrappedX = ((x % tileCount) + tileCount) % tileCount;
        tiles.push({
          key: `${roundedZoom}/${wrappedX}/${y}`,
          uri: tileUrl(roundedZoom, wrappedX, y),
          left: x * TILE_SIZE - topLeft.x,
          top: y * TILE_SIZE - topLeft.y,
        });
      }
    }

    const routePoints = route
      ? simplifyRoute(route, 5)
          .map((point) => {
            const px = project(point, roundedZoom);
            return `${px.x - topLeft.x},${px.y - topLeft.y}`;
          })
          .join(' ')
      : '';

    return { tiles, topLeft, routePoints };
  }, [centerLatitude, centerLongitude, roundedZoom, size.width, size.height, route]);

  const centreKey = `${center.latitude.toFixed(5)}:${center.longitude.toFixed(5)}:${roundedZoom}`;

  useEffect(() => {
    if (lastCommitted.current === centreKey) {
      lastCommitted.current = null;
      opacity.value = 1;
      return;
    }
    opacity.value = 0.7;
    opacity.value = withTiming(1, { duration: 200 });
  }, [centreKey, opacity]);

  const animateStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: pinchScale.value },
    ],
  }));

  const canMove = interactive && Boolean(onCenterChange);

  const commitPan = (dx: number, dy: number) => {
    translateX.value = 0;
    translateY.value = 0;
    if (!onCenterChange || size.width <= 0) return;

    const centrePx = project(center, roundedZoom);
    const next = unproject(
      { x: centrePx.x - dx, y: centrePx.y - dy },
      roundedZoom,
    );
    lastCommitted.current = `${next.latitude.toFixed(5)}:${next.longitude.toFixed(5)}:${roundedZoom}`;
    onCenterChange(next);
  };

  const commitZoom = (scaleFactor: number) => {
    pinchScale.value = 1;
    if (!onZoomChange || !Number.isFinite(scaleFactor) || scaleFactor <= 0) return;
    const next = clamp(
      Math.round(roundedZoom + Math.log2(scaleFactor)),
      MIN_ZOOM,
      MAX_ZOOM,
    );
    if (next !== roundedZoom) onZoomChange(next);
  };

  const panGesture = Gesture.Pan()
    .enabled(canMove)
    .maxPointers(1)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      runOnJS(commitPan)(event.translationX, event.translationY);
    });

  const pinchGesture = Gesture.Pinch()
    .enabled(canMove && Boolean(onZoomChange))
    .onUpdate((event) => {
      pinchScale.value = clamp(event.scale, 0.5, 2.4);
    })
    .onEnd((event) => {
      runOnJS(commitZoom)(event.scale);
    });

  const composed = Gesture.Simultaneous(panGesture, pinchGesture);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (width !== size.width || height !== size.height) {
      setSize({ width, height });
    }
  };

  const markerDragEnd = (id: string, coordinate: LatLng) => {
    onMarkerDragEnd?.(id, coordinate);
  };

  return (
    <View style={[styles.container, style]} onLayout={onLayout}>
      {!hasMapAccess ? (
        <View style={styles.fallback}>
          <MapPinOff size={26} color={palette.textMuted} strokeWidth={1.6} />
          <Text style={styles.fallbackTitle}>Map preview unavailable</Text>
          <Text style={styles.fallbackText}>
            You can still confirm your address and use your current location.
          </Text>
          {__DEV__ ? (
            <Text style={styles.fallbackHint}>
              Configure EXPO_PUBLIC_MAPBOX_TOKEN to enable map tiles.
            </Text>
          ) : null}
        </View>
      ) : (
        <GestureDetector gesture={composed}>
          <Animated.View style={[StyleSheet.absoluteFill, animateStyle]}>
            <View style={styles.tileLayer}>
              {layers?.tiles.map((tile) => (
                <Image
                  key={tile.key}
                  source={{ uri: tile.uri }}
                  style={[
                    styles.tile,
                    { left: tile.left, top: tile.top },
                  ]}
                  contentFit="cover"
                  transition={0}
                  cachePolicy="memory-disk"
                  recyclingKey={tile.key}
                />
              ))}
            </View>

            {layers?.routePoints ? (
              <Svg
                width={size.width}
                height={size.height}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              >
                <Polyline
                  points={layers.routePoints}
                  fill="none"
                  stroke={palette.canvas}
                  strokeWidth={8}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <Polyline
                  points={layers.routePoints}
                  fill="none"
                  stroke={palette.accent}
                  strokeWidth={4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </Svg>
            ) : null}

            {layers
              ? markers.map((marker) => {
                  const px = project(marker.coordinate, roundedZoom);
                  return (
                    <DraggableMarker
                      key={marker.id}
                      marker={marker}
                      x={px.x - layers.topLeft.x}
                      y={px.y - layers.topLeft.y}
                      zoom={roundedZoom}
                      onDragEnd={markerDragEnd}
                    />
                  );
                })
              : null}
          </Animated.View>
        </GestureDetector>
      )}

      {showCenterPin && hasMapAccess ? (
        <View pointerEvents="none" style={styles.centerPin}>
          <View style={styles.centerPinShadow} />
          <PinGlyph />
        </View>
      ) : null}

      {showZoomControls && hasMapAccess ? (
        <View style={styles.zoomControls}>
          <Pressable
            style={styles.zoomButton}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
            onPress={() =>
              onZoomChange?.(clamp(roundedZoom + 1, MIN_ZOOM, MAX_ZOOM))
            }
          >
            <Plus size={16} color={palette.textPrimary} strokeWidth={2} />
          </Pressable>
          <View style={styles.zoomDivider} />
          <Pressable
            style={styles.zoomButton}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
            onPress={() =>
              onZoomChange?.(clamp(roundedZoom - 1, MIN_ZOOM, MAX_ZOOM))
            }
          >
            <Minus size={16} color={palette.textPrimary} strokeWidth={2} />
          </Pressable>
        </View>
      ) : null}

      {hasMapAccess ? (
        <Text style={styles.attribution} pointerEvents="none">
          © Mapbox © OpenStreetMap
        </Text>
      ) : null}

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  tileLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  tile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  centerPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -MARKER_WIDTH / 2,
    marginTop: -MARKER_HEIGHT,
    alignItems: 'center',
  },
  centerPinShadow: {
    position: 'absolute',
    bottom: -3,
    width: 12,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  marker: {
    position: 'absolute',
    width: MARKER_WIDTH,
    height: MARKER_HEIGHT,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  markerGrip: {
    position: 'absolute',
    top: MARKER_HEIGHT - 1,
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.textMuted,
  },
  zoomControls: {
    position: 'absolute',
    right: spacing.sm,
    top: '32%',
    width: 38,
    borderRadius: radii.sm,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  zoomButton: {
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.border,
  },
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 4,
    fontFamily: fontFamilyMono,
    fontSize: 8,
    color: palette.textMuted,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  fallbackTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
    marginTop: spacing.sm,
  },
  fallbackText: {
    ...typography.caption,
    color: palette.textSecondary,
    textAlign: 'center',
  },
  fallbackHint: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
