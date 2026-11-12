import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Car, ChevronRight } from 'lucide-react-native';
import { PressableScale, SectionHead } from '@/components/ui';
import { ServiceCard } from './ServiceCard';
import {
  ADDITIONAL_SERVICES,
  PRIMARY_SERVICES,
  SOS_KINDS,
  URGENT_SERVICES,
  requestRoute,
  sosRoute,
} from './serviceCatalog';
import {
  fontFamilyMono,
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';

const COLLAPSED_COUNT = 3;

/**
 * Home service hierarchy: main services, urgent help, then secondary services.
 * All routing stays on the existing request/SOS routes.
 */
export function HomeServiceSections() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const hasMore = ADDITIONAL_SERVICES.length > COLLAPSED_COUNT;
  const additional = expanded
    ? ADDITIONAL_SERVICES
    : ADDITIONAL_SERVICES.slice(0, COLLAPSED_COUNT);

  return (
    <View>
      <SectionHead index="01" title="Services" />

      <View style={styles.primaryList}>
        {PRIMARY_SERVICES.map((service) => (
          <ServiceCard
            key={service.category}
            service={service}
            variant="primary"
            onPress={() => router.push(requestRoute(service.category))}
          />
        ))}
      </View>

      <PressableScale
        onPress={() => router.push('/driver-go')}
        accessibilityRole="button"
        accessibilityLabel="Driver Go. Hire a professional driver for your own car."
        scaleTo={0.985}
        style={styles.driverGo}
      >
        <View style={styles.driverGoIcon}>
          <Car size={20} color={palette.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.driverGoText}>
          <View style={styles.driverGoTitleRow}>
            <Text style={styles.driverGoTitle}>Driver Go</Text>
            <Text style={styles.driverGoTag}>HOURLY · DAILY</Text>
          </View>
          <Text style={styles.driverGoDetail}>
            Your car. A professional driver.
          </Text>
        </View>
        <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
      </PressableScale>

      <View style={styles.urgentPanel}>
        <View style={styles.urgentRule} />
        <View style={styles.urgentBody}>
          <View style={styles.urgentHead}>
            <Text style={styles.urgentTitle}>Need Immediate Help?</Text>
            <Text style={styles.urgentMeta}>24/7</Text>
          </View>

          {URGENT_SERVICES.map((service) => (
            <ServiceCard
              key={service.category}
              service={service}
              variant="urgent"
              onPress={() => router.push(requestRoute(service.category))}
            />
          ))}

          <View style={styles.sosRow}>
            <Text style={styles.sosLabel}>Quick SOS</Text>
            <View style={styles.sosKinds}>
              {SOS_KINDS.map((kind) => (
                <PressableScale
                  key={kind}
                  onPress={() => router.push(sosRoute(kind))}
                  accessibilityRole="button"
                  accessibilityLabel={`${kind} assistance`}
                  scaleTo={0.95}
                  style={styles.sosKind}
                >
                  <Text style={styles.sosKindText}>{kind}</Text>
                </PressableScale>
              ))}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.additional}>
        <View style={styles.additionalHead}>
          <Text style={styles.additionalTitle}>Additional Services</Text>
          {hasMore ? (
            <PressableScale
              onPress={() => setExpanded((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? 'Show fewer services' : 'Show all services'
              }
              scaleTo={0.95}
            >
              <Text style={styles.additionalAction}>
                {expanded ? 'Show less' : `Show all ${ADDITIONAL_SERVICES.length}`}
              </Text>
            </PressableScale>
          ) : null}
        </View>

        {additional.map((service, index) => (
          <ServiceCard
            key={service.category}
            service={service}
            variant="compact"
            divider={index > 0}
            onPress={() => router.push(requestRoute(service.category))}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  primaryList: {
    gap: spacing.sm,
  },
  driverGo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
  },
  driverGoIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.accentSoftBg,
  },
  driverGoText: { flex: 1 },
  driverGoTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  driverGoTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  driverGoTag: {
    fontFamily: fontFamilyMono,
    fontSize: 8,
    color: palette.accent,
    letterSpacing: 0.8,
  },
  driverGoDetail: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 2,
  },

  urgentPanel: {
    marginTop: spacing.xl,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
    backgroundColor: palette.surfaceAlt,
  },
  urgentRule: {
    height: 2,
    backgroundColor: palette.accent,
  },
  urgentBody: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  urgentHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  urgentTitle: {
    ...typography.heading,
    color: palette.textPrimary,
    flexShrink: 1,
  },
  urgentMeta: {
    fontFamily: fontFamilyMono,
    fontSize: 10,
    color: palette.accent,
    letterSpacing: 0.8,
  },
  sosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  sosLabel: {
    fontFamily: fontFamilyMono,
    fontSize: 9,
    color: palette.textMuted,
    letterSpacing: 1,
  },
  sosKinds: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  sosKind: {
    minHeight: 44,
    justifyContent: 'center',
  },
  sosKindText: {
    ...typography.captionMedium,
    color: palette.textSecondary,
  },

  additional: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  additionalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.xs,
  },
  additionalTitle: {
    ...typography.label,
    color: palette.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  additionalAction: {
    ...typography.label,
    color: palette.accent,
  },
});
