import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  ButtonRow,
  Card,
  Chip,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  FilterChips,
  Input,
  ListItem,
  OfflineBanner,
  ScreenContainer,
  Skeleton,
  SkeletonBlock,
  StatusPill,
  Toast,
} from '@/components/ui';
import { palette, spacing, radii, typography } from '@/theme';

/**
 * DEV-ONLY COMPONENT GALLERY.
 *
 * Shows every shared component in every state for design-system review.
 * Gated behind `__DEV__`: in a production build this route immediately
 * redirects to the app home and renders no gallery content, so it is never
 * part of the production navigation experience. Not linked from any nav bar.
 */
export default function ComponentGallery() {
  // Never ship gallery content to production.
  if (!__DEV__) {
    return <Redirect href="/(app)" />;
  }

  return <GalleryContent />;
}

function GalleryContent() {
  const [text, setText] = useState('');
  const [chip, setChip] = useState('REPAIR');
  const [filter, setFilter] = useState('ALL');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <ScreenContainer style={{ paddingTop: 0 }}>
      <Stack.Screen options={{ title: 'Component Gallery', headerShown: true }} />
      {toastOpen ? <Toast message="Saved successfully" /> : null}
      <OfflineBanner visible message="Offline preview" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Section title="Typography">
          <Text style={styles.display}>Display 32</Text>
          <Text style={styles.titleText}>Title 24</Text>
          <Text style={styles.heading}>Heading 20</Text>
          <Text style={styles.body}>Body 16 — the quick brown fox jumps over the lazy dog.</Text>
          <Text style={styles.caption}>Caption 14</Text>
          <Text style={styles.label}>LABEL 12</Text>
        </Section>

        <Section title="Button">
          <ButtonRow vertical>
            <Button title="Primary" onPress={() => {}} />
            <Button title="Secondary" variant="secondary" onPress={() => {}} />
            <Button title="Destructive" variant="destructive" onPress={() => {}} />
            <Button title="Loading" loading onPress={() => {}} />
            <Button title="Disabled" disabled onPress={() => {}} />
          </ButtonRow>
        </Section>

        <Section title="Input">
          <Input label="Full name" placeholder="Jane Driver" value={text} onChangeText={setText} />
          <Input label="Email" placeholder="you@example.com" error="Enter a valid email" value="" onChangeText={() => {}} />
          <Input label="Disabled" placeholder="Read only" editable={false} value="" onChangeText={() => {}} />
        </Section>

        <Section title="Chip / FilterChips">
          <FilterChips
            options={[
              { label: 'All', value: 'ALL' },
              { label: 'Active', value: 'ACTIVE' },
              { label: 'Done', value: 'DONE' },
            ]}
            value={filter}
            onChange={setFilter}
          />
          <View style={styles.chipRow}>
            {['REPAIR', 'MAINTENANCE', 'TOWING'].map((c) => (
              <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
            ))}
          </View>
        </Section>

        <Section title="StatusPill / Badge">
          <View style={styles.chipRow}>
            <StatusPill label="Requested" tone="neutral" />
            <StatusPill label="Quoted" tone="info" />
            <StatusPill label="Booked" tone="success" />
            <StatusPill label="Pending" tone="warning" />
            <StatusPill label="Cancelled" tone="danger" />
          </View>
          <View style={styles.chipRow}>
            <Badge value={3} />
            <Badge value="New" tone="neutral" />
          </View>
        </Section>

        <Section title="Card / ListItem / Avatar">
          <Card>
            <View style={styles.cardRow}>
              <Avatar name="Jane Driver" />
              <View style={styles.cardBody}>
                <Text style={styles.bodyMedium}>A/c not cooling</Text>
                <Text style={styles.caption}>Maruti Suzuki · 2.1 km away</Text>
              </View>
              <StatusPill label="Open" tone="info" />
            </View>
          </Card>
          <View style={styles.listGap} />
          <ListItem title="Home" subtitle="12 MG Road, Bengaluru" right={<Text style={styles.chevron}>›</Text>} onPress={() => {}} />
          <ListItem title="Work" subtitle="Embassy Tech Village" right={<Text style={styles.chevron}>›</Text>} />
        </Section>

        <Section title="Skeleton">
          <Card>
            <SkeletonBlock lines={2} />
          </Card>
          <View style={styles.chipRow}>
            <Skeleton width={60} height={60} radius={radii.md} />
            <Skeleton width={120} height={16} />
          </View>
        </Section>

        <Section title="Empty / Error">
          <EmptyState
            title="No requests yet"
            message="Post a request to get quotes from nearby mechanics."
            action={<Button title="New request" onPress={() => {}} />}
          />
          <ErrorState message="Couldn't load your bookings." onRetry={() => {}} />
        </Section>

        <Section title="Overlays">
          <ButtonRow>
            <Button title="Open sheet" variant="secondary" onPress={() => setSheetOpen(true)} />
            <Button title="Open dialog" variant="secondary" onPress={() => setDialogOpen(true)} />
            <Button title="Show toast" variant="secondary" onPress={() => setToastOpen(true)} />
          </ButtonRow>
          <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Example sheet">
            <Text style={styles.body}>Sheet content goes here.</Text>
            <View style={styles.listGap} />
            <Button title="Close" onPress={() => setSheetOpen(false)} />
          </BottomSheet>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm booking</DialogTitle>
                <DialogDescription>
                  Accepting this quotation books the provider for the scheduled date. You can
                  cancel from Bookings before work starts.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button title="Cancel" variant="secondary" onPress={() => setDialogOpen(false)} />
                <Button title="Confirm" onPress={() => setDialogOpen(false)} />
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.label,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  display: { ...typography.display, color: palette.textPrimary },
  titleText: { ...typography.title, color: palette.textPrimary },
  heading: { ...typography.heading, color: palette.textPrimary },
  body: { ...typography.body, color: palette.textSecondary, marginVertical: spacing.xs },
  bodyMedium: { ...typography.bodyMedium, color: palette.textPrimary },
  caption: { ...typography.caption, color: palette.textSecondary },
  label: { ...typography.label, color: palette.textMuted },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  listGap: { height: spacing.md },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardBody: { flex: 1 },
  chevron: { ...typography.title, color: palette.textMuted },
});
