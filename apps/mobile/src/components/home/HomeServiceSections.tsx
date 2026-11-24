import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Car, ChevronRight } from 'lucide-react-native';
import { PressableScale, SectionHead } from '@/components/ui';
import { ServiceCard } from './ServiceCard';
import {
  ADDITIONAL_SERVICES,
  PRIMARY_SERVICES,
  URGENT_SERVICES,
  requestRoute,
} from './serviceCatalog';
import {
  palette,
  radii,
  spacing,
  typography,
} from '@/theme';


/**
 * Home service hierarchy: main services, urgent help, then secondary services.
 * All routing stays on the existing request/SOS routes.
 */
export function HomeServiceSections() {
  const router = useRouter();
  // Inspection lives with the other services instead of its own section.
  const services = [...PRIMARY_SERVICES, ...ADDITIONAL_SERVICES];

  return (
    <View>
      <SectionHead title="Services" />

      <View style={styles.primaryList}>
        {services.map((service) => (
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
          <Text style={styles.driverGoTitle}>Driver Go</Text>
          <Text style={styles.driverGoDetail}>
            A professional driver for your car, hourly or daily
          </Text>
        </View>
        <ChevronRight size={16} color={palette.textMuted} strokeWidth={1.8} />
      </PressableScale>

      <View style={styles.urgentPanel}>
        <View style={styles.urgentRule} />
        <View style={styles.urgentBody}>
          <View style={styles.urgentHead}>
            <Text style={styles.urgentTitle}>Need immediate help?</Text>
          </View>

          {URGENT_SERVICES.map((service) => (
            <ServiceCard
              key={service.category}
              service={service}
              variant="urgent"
              onPress={() => router.push(requestRoute(service.category))}
            />
          ))}

        </View>
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
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
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
  driverGoTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  driverGoDetail: {
    ...typography.label,
    color: palette.textMuted,
    marginTop: 2,
  },

  urgentPanel: {
    marginTop: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
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

});
