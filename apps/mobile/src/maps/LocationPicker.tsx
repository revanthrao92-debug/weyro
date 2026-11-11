import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Bookmark,
  LocateFixed,
  MapPin,
  Search,
  X,
} from 'lucide-react-native';
import { Button, PressableScale } from '@/components/ui';
import { useAddresses } from '@/hooks/useProfile';
import { MapSurface } from './MapSurface';
import {
  FALLBACK_CENTER,
  REVERSE_DEBOUNCE_MS,
  SEARCH_DEBOUNCE_MS,
  hasMapAccess,
} from './config';
import {
  MapRequestError,
  reverseGeocode,
  searchPlaces,
  type Place,
} from './client';
import type { LatLng } from './geo';
import type { PickedLocation } from './types';
import { useDeviceLocation } from './useDeviceLocation';
import {
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

export type LocationPickerProps = {
  visible: boolean;
  title: string;
  hint?: string;
  initial?: PickedLocation | null;
  /** Offer the first saved address when no initial point is supplied. */
  useSavedFallback?: boolean;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
};

const closeOnEmpty = (value: string) => value.trim().length === 0;

export function LocationPicker({
  visible,
  title,
  hint,
  initial,
  useSavedFallback = true,
  confirmLabel = 'Confirm location',
  onClose,
  onConfirm,
}: LocationPickerProps) {
  const insets = useSafeAreaInsets();
  const { data: savedData } = useAddresses();
  const saved = savedData?.addresses ?? [];

  const [center, setCenter] = useState<LatLng>(FALLBACK_CENTER);
  const [zoom, setZoom] = useState(16);
  const [coordinate, setCoordinate] = useState<LatLng>(FALLBACK_CENTER);
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const gps = useDeviceLocation();
  const skipReverse = useRef(false);
  const skipSearch = useRef(false);
  const lastResolved = useRef<string | null>(null);
  const proximity = useRef<LatLng>(FALLBACK_CENTER);
  /** The coordinate the map is actually settled on — guards stale effects. */
  const activeCoordinate = useRef<LatLng>(FALLBACK_CENTER);

  // Snapshot live values so opening the sheet does not reset while typing.
  const initialRef = useRef(initial);
  const savedRef = useRef(saved);
  useEffect(() => {
    initialRef.current = initial;
    savedRef.current = saved;
  });

  useEffect(() => {
    if (!visible) return;

    const savedFallback = useSavedFallback ? savedRef.current[0] : undefined;
    const start =
      initialRef.current ??
      (savedFallback
        ? {
            address: savedFallback.address,
            latitude: savedFallback.latitude,
            longitude: savedFallback.longitude,
            label: savedFallback.title,
          }
        : null);

    const coords = start
      ? { latitude: start.latitude, longitude: start.longitude }
      : FALLBACK_CENTER;

    activeCoordinate.current = coords;
    setCenter(coords);
    setCoordinate(coords);
    setZoom(start ? 16 : 14);
    setAddress(start?.address ?? '');
    setLabel(start?.label ?? '');
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSearchError(null);
    setResolving(false);
    setResolveError(null);
    setShowManual(!hasMapAccess);
    skipReverse.current = Boolean(start);
    lastResolved.current = start
      ? `${start.latitude.toFixed(5)},${start.longitude.toFixed(5)}`
      : null;
    proximity.current = coords;
  }, [visible, useSavedFallback]);

  // Search — debounced, abortable, never fires for <3 characters.
  useEffect(() => {
    if (!visible) return;
    if (skipSearch.current) {
      skipSearch.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const places = await searchPlaces(trimmed, {
          signal: controller.signal,
          proximity: proximity.current,
        });
        if (controller.signal.aborted) return;
        setResults(places);
        setShowResults(true);
        setSearchError(null);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof MapRequestError && error.aborted) return;
        setResults([]);
        setShowResults(true);
        setSearchError(
          error instanceof MapRequestError
            ? error.message
            : 'Search is unavailable. Type the address instead.',
        );
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
      setSearching(false);
    };
  }, [query, visible]);

  // Reverse geocode only after a settled pan/GPS fix, never on every frame.
  useEffect(() => {
    if (!visible || !hasMapAccess) return;
    // Ignore the commit where the sheet just opened: its coordinate is stale.
    const active = activeCoordinate.current;
    if (
      Math.abs(active.latitude - coordinate.latitude) > 1e-7 ||
      Math.abs(active.longitude - coordinate.longitude) > 1e-7
    ) {
      return;
    }

    const key = `${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
    if (skipReverse.current) {
      skipReverse.current = false;
      lastResolved.current = key;
      return;
    }
    if (lastResolved.current === key) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResolving(true);
      try {
        const place = await reverseGeocode(coordinate, controller.signal);
        if (controller.signal.aborted) return;
        lastResolved.current = key;
        if (place) {
          setAddress(place.address);
          setLabel(place.name);
          setResolveError(null);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof MapRequestError && error.aborted) return;
        setResolveError(
          'Address lookup failed. Check your connection or type the address.',
        );
      } finally {
        if (!controller.signal.aborted) setResolving(false);
      }
    }, REVERSE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [coordinate, visible]);

  const handleCenterChange = (next: LatLng) => {
    proximity.current = next;
    activeCoordinate.current = next;
    setCenter(next);
    setCoordinate(next);
    setLabel('');
    setResolveError(null);
  };

  const selectPlace = (place: Place) => {
    skipReverse.current = true;
    skipSearch.current = true;
    const next = { latitude: place.latitude, longitude: place.longitude };
    proximity.current = next;
    activeCoordinate.current = next;
    setCenter(next);
    setCoordinate(next);
    setZoom(17);
    setAddress(place.address);
    setLabel(place.name);
    setQuery(place.name);
    setResults([]);
    setShowResults(false);
    setResolveError(null);
    Keyboard.dismiss();
  };

  const selectSaved = (item: {
    title: string;
    address: string;
    latitude: number;
    longitude: number;
  }) => {
    skipReverse.current = true;
    skipSearch.current = true;
    const next = { latitude: item.latitude, longitude: item.longitude };
    proximity.current = next;
    activeCoordinate.current = next;
    setCenter(next);
    setCoordinate(next);
    setZoom(16);
    setAddress(item.address);
    setLabel(item.title);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setResolveError(null);
  };

  const locateMe = async () => {
    const coords = await gps.request();
    if (!coords) return;
    skipReverse.current = false;
    proximity.current = coords;
    activeCoordinate.current = coords;
    setCenter(coords);
    setCoordinate(coords);
    setZoom(17);
    setResolveError(null);
    setLabel('Current location');
    setAddress((current) => current.trim() || 'Current location');
  };

  const addressUsable = address.trim().length >= 3;
  const canConfirm = Boolean(coordinate) && addressUsable && !resolving;

  const confirm = () => {
    if (!canConfirm || !coordinate) return;
    onConfirm({
      address: address.trim(),
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      label: label || undefined,
    });
  };

  const permissionMessage =
    gps.status === 'denied' || gps.status === 'error' ? gps.message : null;
  const mapVisible = visible;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="fullScreen"
    >
      {mapVisible ? (
        <View style={styles.root}>
          <MapSurface
            center={center}
            zoom={zoom}
            onCenterChange={handleCenterChange}
            onZoomChange={setZoom}
            showCenterPin
            interactive={hasMapAccess}
            showZoomControls
            style={styles.map}
          />

          <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
            <PressableScale
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close location picker"
              style={styles.closeButton}
              scaleTo={0.92}
            >
              <X size={18} color={palette.textPrimary} strokeWidth={2} />
            </PressableScale>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Text>
              {hint ? (
                <Text style={styles.headerHint} numberOfLines={1}>
                  {hint}
                </Text>
              ) : null}
            </View>
            <View style={styles.headerSpacer} />
          </View>

          <View style={[styles.searchWrap, { top: insets.top + 68 }]}>
            <View style={styles.searchField}>
              <Search size={16} color={palette.textMuted} strokeWidth={2} />
              <TextInput
                value={query}
                onChangeText={(value) => {
                  setQuery(value);
                  if (showResults) setShowResults(true);
                }}
                onFocus={() => setShowResults(results.length > 0)}
                placeholder="Search area, landmark or address"
                placeholderTextColor={palette.textMuted}
                style={styles.searchInput}
                accessibilityLabel="Search for an address or landmark"
                returnKeyType="search"
                autoCorrect={false}
              />
              {searching ? (
                <ActivityIndicator size="small" color={palette.textMuted} />
              ) : closeOnEmpty(query) ? null : (
                <Pressable
                  onPress={() => {
                    setQuery('');
                    setResults([]);
                    setShowResults(false);
                    setSearchError(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={8}
                >
                  <X size={15} color={palette.textMuted} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {showResults && (query.trim().length >= 3 || searchError) ? (
              <ScrollView
                style={styles.results}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.resultsContent}
              >
                {searchError ? (
                  <View style={styles.resultEmpty}>
                    <AlertTriangle
                      size={15}
                      color={palette.warning}
                      strokeWidth={2}
                    />
                    <Text style={styles.resultEmptyText}>{searchError}</Text>
                  </View>
                ) : results.length === 0 && !searching ? (
                  <View style={styles.resultEmpty}>
                    <Text style={styles.resultEmptyText}>
                      No matches. Try a nearby landmark, or enter the address
                      below.
                    </Text>
                  </View>
                ) : (
                  results.map((place, index) => (
                    <Pressable
                      key={place.id}
                      onPress={() => selectPlace(place)}
                      style={[
                        styles.resultRow,
                        index > 0 && styles.resultDivider,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`${place.name}, ${place.address}`}
                    >
                      <MapPin
                        size={15}
                        color={palette.accent}
                        strokeWidth={1.8}
                      />
                      <View style={styles.resultText}>
                        <Text style={styles.resultName} numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text style={styles.resultAddress} numberOfLines={1}>
                          {place.address}
                        </Text>
                      </View>
                    </Pressable>
                  ))
                )}
              </ScrollView>
            ) : null}
          </View>

          <PressableScale
            onPress={() => void locateMe()}
            disabled={gps.status === 'requesting'}
            accessibilityRole="button"
            accessibilityLabel="Use my current location"
            scaleTo={0.94}
            style={[styles.locate, { top: insets.top + 132 }]}
          >
            {gps.status === 'requesting' ? (
              <ActivityIndicator size="small" color={palette.onAccent} />
            ) : (
              <LocateFixed size={20} color={palette.onAccent} strokeWidth={2} />
            )}
          </PressableScale>

          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
            style={styles.sheetWrap}
          >
            <View
              style={[
                styles.sheet,
                { paddingBottom: Math.max(insets.bottom, spacing.md) },
              ]}
            >
              <View style={styles.handle} />

              <View style={styles.sheetHead}>
                <MapPin size={15} color={palette.accent} strokeWidth={2} />
                <Text style={styles.sheetLabel} numberOfLines={1}>
                  {resolving
                    ? 'Finding the address…'
                    : label || 'Selected location'}
                </Text>
                {resolving ? (
                  <ActivityIndicator size="small" color={palette.textMuted} />
                ) : null}
              </View>

              <Text style={styles.addressText} numberOfLines={2}>
                {address.trim().length > 0
                  ? address
                  : 'Move the map to place the pin, or type the address below.'}
              </Text>

              {showManual ? (
                <View style={styles.manualField}>
                  <Text style={styles.manualLabel}>Address details</Text>
                  <TextInput
                    value={address}
                    onChangeText={(value) => {
                      setAddress(value);
                      setLabel('');
                    }}
                    placeholder="House / street / landmark"
                    placeholderTextColor={palette.textMuted}
                    style={styles.manualInput}
                    accessibilityLabel="Address details"
                    multiline
                  />
                </View>
              ) : (
                <Pressable
                  onPress={() => setShowManual(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Enter address manually"
                  style={styles.manualToggle}
                >
                  <Text style={styles.manualToggleText}>Enter address manually</Text>
                </Pressable>
              )}

              {saved.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.savedRow}
                >
                  {saved.slice(0, 5).map((item, index) => {
                    const active =
                      Math.abs(item.latitude - coordinate.latitude) < 1e-5 &&
                      Math.abs(item.longitude - coordinate.longitude) < 1e-5;
                    return (
                      <Pressable
                        key={item.id ?? `${item.title}-${index}`}
                        onPress={() => selectSaved(item)}
                        style={[styles.savedChip, active && styles.savedChipActive]}
                        accessibilityRole="button"
                        accessibilityLabel={`Use saved address ${item.title}`}
                      >
                        <Bookmark
                          size={12}
                          color={active ? palette.accent : palette.textMuted}
                          strokeWidth={2}
                        />
                        <Text
                          style={[
                            styles.savedChipText,
                            active && styles.savedChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {item.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {permissionMessage ? (
                <View style={styles.notice}>
                  <AlertTriangle
                    size={14}
                    color={palette.warning}
                    strokeWidth={2}
                  />
                  <Text style={styles.noticeText}>{permissionMessage}</Text>
                </View>
              ) : null}

              {resolveError ? (
                <View style={styles.notice}>
                  <AlertTriangle
                    size={14}
                    color={palette.warning}
                    strokeWidth={2}
                  />
                  <Text style={styles.noticeText}>{resolveError}</Text>
                </View>
              ) : null}

              {!hasMapAccess ? (
                <View style={styles.notice}>
                  <AlertTriangle
                    size={14}
                    color={palette.warning}
                    strokeWidth={2}
                  />
                  <Text style={styles.noticeText}>
                    Map tiles are not configured. Your saved or current location
                    is used with the address you enter.
                  </Text>
                </View>
              ) : null}

              <Button
                title={confirmLabel}
                onPress={confirm}
                disabled={!canConfirm}
              />
              <Text style={styles.footnote}>
                {coordinate
                  ? 'Used to match nearby providers and price the trip.'
                  : 'Choose a location to continue.'}
              </Text>
            </View>
          </KeyboardAvoidingView>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.canvas },
  map: { flex: 1 },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: {
    ...typography.bodyMedium,
    color: palette.textPrimary,
  },
  headerHint: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 1,
  },
  headerSpacer: { width: 38 },
  searchWrap: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: palette.textPrimary,
    paddingVertical: 10,
  },
  results: {
    marginTop: 6,
    maxHeight: 296,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    overflow: 'hidden',
  },
  resultsContent: { paddingVertical: 2 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  resultDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  resultText: { flex: 1 },
  resultName: { ...typography.bodyMedium, color: palette.textPrimary },
  resultAddress: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 2,
  },
  resultEmpty: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    padding: spacing.md,
  },
  resultEmptyText: {
    ...typography.caption,
    color: palette.textSecondary,
    flex: 1,
  },
  locate: {
    position: 'absolute',
    right: spacing.md,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accent,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  sheetWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.borderStrong,
    marginBottom: spacing.xs,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sheetLabel: {
    ...typography.label,
    color: palette.textSecondary,
    flex: 1,
  },
  addressText: {
    ...typography.body,
    color: palette.textPrimary,
  },
  manualToggle: { paddingVertical: 2, alignSelf: 'flex-start' },
  manualToggleText: {
    ...typography.label,
    color: palette.accent,
  },
  manualField: { gap: 4 },
  manualLabel: { ...typography.label, color: palette.textMuted },
  manualInput: {
    minHeight: 44,
    maxHeight: 76,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
    ...typography.body,
    color: palette.textPrimary,
  },
  savedRow: { gap: spacing.xs, paddingVertical: 2 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surfaceAlt,
    maxWidth: 160,
  },
  savedChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoftBg,
  },
  savedChipText: { ...typography.label, color: palette.textSecondary },
  savedChipTextActive: { color: palette.accent },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  noticeText: {
    ...typography.caption,
    color: palette.textSecondary,
    flex: 1,
  },
  footnote: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    textAlign: 'center',
  },
});
