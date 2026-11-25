import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import {
  PageHeader,
  StatusPill,
  Button,
  Card,
  ScreenContainer,
  SectionHead,
} from '@/components/ui';
import { PhotoPicker } from '@/components/requests/PhotoPicker';
import {
  useProviderProfile,
  useSubmitVerificationDocuments,
} from '@/hooks/useProfile';
import type { UploadedImage } from '@/services/uploads';
import { titleize as labelize } from '@/utils/format';
import { palette, spacing, typography } from '@/theme';

const STATUS_LABEL: Record<string, string> = {
  VERIFIED: 'Verified',
  PENDING: 'Awaiting review',
  REJECTED: 'Not approved',
  SUSPENDED: 'Suspended',
};

export default function VerificationDocumentsScreen() {
  const router = useRouter();
  const profile = useProviderProfile();
  const submit = useSubmitVerificationDocuments();
  const [registration, setRegistration] = useState<UploadedImage[]>([]);
  const [ownerId, setOwnerId] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);

  const status = profile.data?.verificationStatus ?? 'PENDING';
  const isVerified = status === 'VERIFIED';
  const canSubmit = registration.length > 0 && ownerId.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert(
        'Documents needed',
        'Upload the business registration and owner ID before submitting.',
      );
      return;
    }
    try {
      await submit.mutateAsync([
        { label: 'Business registration', key: registration[0].key },
        { label: 'Owner ID', key: ownerId[0].key },
      ]);
      Alert.alert(
        'Submitted for review',
        'Weyro will review your documents. Uploading documents does not verify the account automatically.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (error: any) {
      Alert.alert(
        'Could not submit',
        error?.message || 'Try again. Your documents were not saved.',
      );
    }
  };

  return (
    <ScreenContainer chrome="dark" padded={false} safeBottom>
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <PageHeader back title="Verification" subtitle="Documents Weyro checks before you can take work" />
        <Card>
          <StatusPill
            label={STATUS_LABEL[status] ?? labelize(status)}
            tone={isVerified ? 'success' : status === 'PENDING' ? 'warning' : 'danger'}
          />
          <Text style={styles.help}>
            {isVerified
              ? 'Your business is verified. You can receive marketplace work. Nothing more to upload.'
              : 'Verification is reviewed by Weyro. Only verified providers can receive production marketplace work.'}
          </Text>
        </Card>

        {!isVerified && (
          <>
            <SectionHead title="Business registration" />
            <Text style={styles.help}>
              GST certificate, trade licence or shop registration.
            </Text>
            <PhotoPicker
              images={registration}
              onChange={setRegistration}
              max={1}
              folder="verification-documents"
              onUploadingChange={setUploading}
              helper="One clear photo or scan."
            />

            <SectionHead title="Owner ID" />
            <Text style={styles.help}>
              Government-issued photo ID of the business owner.
            </Text>
            <PhotoPicker
              images={ownerId}
              onChange={setOwnerId}
              max={1}
              folder="verification-documents"
              onUploadingChange={setUploading}
              helper="One clear photo or scan."
            />

            <Button
              title={submit.isPending ? 'Submitting…' : 'Submit for review'}
              onPress={handleSubmit}
              disabled={!canSubmit || uploading || submit.isPending}
              style={styles.submit}
            />
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  help: {
    ...typography.body,
    color: palette.textSecondary,
    marginTop: spacing.sm,
  },
  submit: { marginTop: spacing.xl },
});
