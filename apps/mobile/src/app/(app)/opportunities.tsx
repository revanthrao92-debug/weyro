import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useBroadcastFeed, useMyQuotations } from "@/hooks/useRequests";
import { useNow } from "@/hooks/useNow";
import { useRefreshControl } from "@/hooks/useRefreshControl";
import {
  ScreenContainer,
  Button,
  StatusPill,
  EmptyState,
  Skeleton,
  FadeSlideIn,
  PageHeader,
  PressableScale,
} from "@/components/ui";
import { palette, radii, spacing, typography } from "@/theme";
import { titleize as labelize } from "@/utils/format";
import { timeLeft } from "@/utils/quotes";

export default function ProviderRequestsScreen() {
  const router = useRouter();
  const { providerProfile } = useAuth();
  const providerType = providerProfile?.providerType ?? "";
  const isMechanic = ["MECHANIC", "GARAGE", "AUTHORIZED_CENTER"].includes(
    providerType,
  );
  const isTowing = providerType === "TOWING";
  const isRoadside = providerType === "ROADSIDE";
  const kind = isTowing
    ? "towing jobs"
    : isRoadside
      ? "roadside calls"
      : isMechanic
        ? "repair jobs"
        : "part requests";
  const { data, isLoading, refetch } = useBroadcastFeed();
  const { data: myQuotes } = useMyQuotations({ limit: 50 });
  const refreshControl = useRefreshControl(refetch);
  const now = useNow();

  const requests = data?.items ?? [];

  const quoteByRequest = useMemo(() => {
    const map = new Map<string, { id: string; status: string }>();
    for (const quote of myQuotes?.items ?? []) {
      map.set(quote.requestId, { id: quote.id, status: quote.status });
    }
    return map;
  }, [myQuotes]);

  const header = (
    <PageHeader
      title="Requests"
      subtitle={
        isLoading
          ? `Open ${kind} near you`
          : requests.length === 0
            ? `No open ${kind} near you`
            : `${requests.length} open ${kind} near you`
      }
    />
  );

  return (
    <ScreenContainer chrome="dark" safeBottom padded={false}>
      <FlatList
        data={isLoading ? [] : requests}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <View>
            {header}
            {isLoading
              ? [0, 1, 2].map((i) => (
                  <View key={i} style={styles.card}>
                    <Skeleton width="60%" height={18} />
                    <Skeleton
                      width="90%"
                      height={12}
                      style={{ marginTop: spacing.sm }}
                    />
                    <Skeleton
                      width="40%"
                      height={12}
                      style={{ marginTop: spacing.sm }}
                    />
                  </View>
                ))
              : null}
          </View>
        }
        ListEmptyComponent={
          isLoading ? undefined : (
            <EmptyState
              title="Nothing near you right now"
              message={`You get a notification as soon as a customer in your area posts new ${kind}.`}
              action={
                <Button
                  title="Check again"
                  variant="secondary"
                  onPress={() => void refetch()}
                />
              }
            />
          )
        }
        renderItem={({ item, index }) => (
          <FadeSlideIn delay={Math.min(index, 6) * 50}>
            <RequestCard
              item={item}
              isTowing={isTowing}
              now={now}
              myQuote={quoteByRequest.get(item.id)}
              onPress={() => router.push(`/requests/${item.id}`)}
            />
          </FadeSlideIn>
        )}
      />
    </ScreenContainer>
  );
}

function RequestCard({
  item,
  isTowing,
  now,
  myQuote,
  onPress,
}: {
  item: any;
  isTowing: boolean;
  now: number;
  myQuote?: { id: string; status: string };
  onPress: () => void;
}) {
  const car =
    item.vehicle ??
    (item.vehicleMake
      ? {
          make: item.vehicleMake,
          model: item.vehicleModel,
          year: item.vehicleYear,
        }
      : null);
  const carText = car
    ? [car.make, car.model, car.year].filter(Boolean).join(" ")
    : null;
  const km = Number(item.distanceKm);
  const where = [
    Number.isFinite(km) && km > 0
      ? `${km < 1 ? "Under 1" : km.toFixed(1)} km away`
      : null,
    item.address,
  ]
    .filter(Boolean)
    .join(", ");
  const count = Number(item.quotationsCount ?? 0);
  const left = timeLeft(item.quotesUntil ?? item.expiresAt, now);
  const urgent = item.urgency === "URGENT" || item.urgency === "EMERGENCY";
  const cta = isTowing ? "Send fare" : "Send quote";

  return (
    <View style={styles.card}>
      {/* Details are one tap target; the Send quote button sits beside it, not inside (no nested buttons). */}
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Open request: ${item.title}. ${where}. ${count === 0 ? "No quotes yet" : `${count} quotes so far`}`}
        scaleTo={0.99}
      >
        <View style={styles.cardTop}>
          <Text style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {urgent ? (
            <StatusPill
              label={labelize(item.urgency)}
              tone={item.urgency === "EMERGENCY" ? "danger" : "warning"}
            />
          ) : null}
        </View>
        {carText ? <Text style={styles.car}>{carText}</Text> : null}
        <Text style={styles.where} numberOfLines={1}>
          {where}
        </Text>
        {item.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {String(item.description).replace(/\s*\n+\s*/g, " ")}
          </Text>
        ) : null}

        {isTowing ? (
          <View style={styles.tow}>
            <Text style={styles.towLine} numberOfLines={2}>
              To {item.dropoffAddress ?? "drop-off not set"}
            </Text>
            <Text style={styles.description}>
              {[
                item.towingDistanceKm
                  ? `${item.towingDistanceKm} km tow`
                  : null,
                item.vehicleWeightKg ? `${item.vehicleWeightKg} kg` : null,
                item.towingVehicleType
                  ? labelize(item.towingVehicleType)
                  : null,
                item.towingEstimatedFare
                  ? `about ₹${Number(item.towingEstimatedFare).toLocaleString("en-IN")}`
                  : null,
              ]
                .filter(Boolean)
                .join(", ")}
            </Text>
          </View>
        ) : null}
      </PressableScale>

      <View style={styles.footer}>
        <View style={styles.footerText}>
          <Text style={[styles.competition, count === 0 && styles.first]}>
            {count === 0
              ? "Be the first to quote"
              : `${count} quote${count === 1 ? "" : "s"} so far`}
          </Text>
          <Text style={styles.closes}>
            {left
              ? `Quotes close in ${left.replace(" more", "")}`
              : "Closing now"}
          </Text>
        </View>
        {myQuote ? (
          <StatusPill
            label={`You quoted, ${labelize(myQuote.status).toLowerCase()}`}
            tone="info"
          />
        ) : (
          <Button title={cta} onPress={onPress} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  title: { ...typography.bodyMedium, color: palette.textPrimary, flex: 1 },
  car: {
    ...typography.caption,
    color: palette.textPrimary,
    marginTop: spacing.xs,
  },
  where: { ...typography.caption, color: palette.textSecondary, marginTop: 2 },
  description: {
    ...typography.caption,
    color: palette.textSecondary,
    marginTop: spacing.sm,
  },
  tow: { marginTop: spacing.sm },
  towLine: { ...typography.caption, color: palette.textPrimary },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  footerText: { flex: 1 },
  competition: { ...typography.captionMedium, color: palette.textPrimary },
  first: { color: palette.success },
  closes: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
});
