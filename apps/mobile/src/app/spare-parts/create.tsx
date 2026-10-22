import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { BorderRadius, Elevation, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { apiClient } from '@/services/api-client';

const CONDITIONS: { key: 'OEM' | 'AFTERMARKET' | 'USED'; label: string }[] = [
  { key: 'OEM', label: 'OEM' },
  { key: 'AFTERMARKET', label: 'Aftermarket' },
  { key: 'USED', label: 'Used' },
];

export default function CreateSparePartScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [compatibleMakes, setCompatibleMakes] = useState('');
  const [compatibleModels, setCompatibleModels] = useState('');
  const [condition, setCondition] = useState<'OEM' | 'AFTERMARKET' | 'USED'>('OEM');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);

    const nameTrimmed = name.trim();
    const partNumberTrimmed = partNumber.trim();
    if (!nameTrimmed || !partNumberTrimmed) {
      setError('Name and part number are required.');
      return;
    }

    const priceNum = Number(price);
    if (!priceNum || priceNum <= 0) {
      setError('Please enter a valid price in ₹.');
      return;
    }

    const stockNum = Number.parseInt(stockQuantity, 10);
    if (!Number.isFinite(stockNum) || stockNum < 0) {
      setError('Please enter a valid stock quantity.');
      return;
    }

    const makes = compatibleMakes
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    const models = compatibleModels
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);

    const imageUrlTrimmed = imageUrl.trim();
    if (imageUrlTrimmed && !/^https?:\/\//.test(imageUrlTrimmed)) {
      setError('Image URL must start with http:// or https://.');
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/spare-parts', {
        name: nameTrimmed,
        partNumber: partNumberTrimmed,
        compatibleMakes: makes,
        compatibleModels: models,
        condition,
        price: priceNum,
        stockQuantity: stockNum,
        imageUrl: imageUrlTrimmed || undefined,
      });

      Alert.alert(
        'Spare Part Listed',
        'Your spare part is now live in the catalog.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/spare-parts'),
          },
        ],
      );
    } catch (err: any) {
      setError(
        err?.message || 'Unable to list spare part. Check your connection and try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = makeStyles(theme);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.contentWrapper}>

          {/* Header */}
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.backBtn}>
              <ThemedText style={styles.backText}>‹</ThemedText>
            </Pressable>
            <ThemedText type="smallBold" style={styles.headerTitle}>
              List a Spare Part
            </ThemedText>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorRow}>
              <ThemedText style={styles.errorText} themeColor="danger">
                {error}
              </ThemedText>
            </View>
          )}

          {/* Name */}
          <ThemedText style={styles.label}>Spare Part Name</ThemedText>
          <TextInput
            accessibilityLabel="Spare part name"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. Front Brake Pad Set"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {/* Part Number */}
          <ThemedText style={styles.label}>Part Number</ThemedText>
          <TextInput
            accessibilityLabel="Part number"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. BP-2024-XYZ"
            placeholderTextColor={theme.textSecondary}
            value={partNumber}
            onChangeText={setPartNumber}
            autoCapitalize="characters"
          />

          {/* Condition */}
          <ThemedText style={styles.label}>Condition</ThemedText>
          <View style={styles.chipRow}>
            {CONDITIONS.map((c) => (
              <Pressable
                key={c.key}
                accessibilityRole="button"
                accessibilityState={{ selected: condition === c.key }}
                onPress={() => setCondition(c.key)}
                style={[
                  styles.conditionChip,
                  {
                    borderColor: condition === c.key ? theme.primary : theme.border,
                    backgroundColor:
                      condition === c.key ? theme.primarySurface : 'transparent',
                  },
                ]}>
                <ThemedText
                  style={[
                    styles.conditionChipText,
                    condition === c.key && { color: theme.primary },
                  ]}>
                  {c.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Compatible Makes */}
          <ThemedText style={styles.label}>Compatible Makes (comma-separated)</ThemedText>
          <TextInput
            accessibilityLabel="Compatible makes"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. Maruti, Hyundai, Tata"
            placeholderTextColor={theme.textSecondary}
            value={compatibleMakes}
            onChangeText={setCompatibleMakes}
            autoCapitalize="words"
          />

          {/* Compatible Models */}
          <ThemedText style={styles.label}>Compatible Models (comma-separated)</ThemedText>
          <TextInput
            accessibilityLabel="Compatible models"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. Swift, i10, Nexon"
            placeholderTextColor={theme.textSecondary}
            value={compatibleModels}
            onChangeText={setCompatibleModels}
            autoCapitalize="words"
          />

          {/* Price */}
          <ThemedText style={styles.label}>Price (₹ INR)</ThemedText>
          <TextInput
            accessibilityLabel="Price in Indian rupees"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. 1499"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={price}
            onChangeText={setPrice}
          />

          {/* Stock Quantity */}
          <ThemedText style={styles.label}>Stock Quantity</ThemedText>
          <TextInput
            accessibilityLabel="Stock quantity"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. 5"
            placeholderTextColor={theme.textSecondary}
            keyboardType="numeric"
            value={stockQuantity}
            onChangeText={setStockQuantity}
          />

          {/* Image URL */}
          <ThemedText style={styles.label}>Image URL (optional)</ThemedText>
          <TextInput
            accessibilityLabel="Image URL"
            style={[
              styles.input,
              { color: theme.text, borderColor: theme.border },
            ]}
            placeholder="https://..."
            placeholderTextColor={theme.textSecondary}
            value={imageUrl}
            onChangeText={setImageUrl}
            autoCapitalize="none"
          />

          {/* Submit */}
          <Pressable
            onPress={handleSubmit}
            accessibilityRole="button"
            accessibilityLabel="List spare part"
            disabled={isSubmitting}
            style={[
              styles.submitBtn,
              { backgroundColor: theme.primary },
              isSubmitting && { opacity: 0.7 },
            ]}>
            <ThemedText
              style={[styles.submitText, { color: theme.inverseText }]}>
              {isSubmitting ? 'Listing...' : 'List Spare Part'}
            </ThemedText>
          </Pressable>

          <View style={styles.spacer} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (
  theme: NonNullable<ReturnType<typeof useTheme>>,
) =>
  StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  contentWrapper: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.two,
  },
  backBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  backText: {
    fontSize: 18,
    color: theme.primary,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginLeft: Spacing.two,
    color: theme.text,
  },
  errorRow: {
    width: '100%',
    marginBottom: Spacing.two,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: Spacing.one,
    width: '100%',
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.medium,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    fontSize: 14,
    color: theme.text,
    marginBottom: Spacing.two,
    width: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginBottom: Spacing.two,
    width: '100%',
  },
  conditionChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conditionChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: Spacing.three,
    borderRadius: BorderRadius.large,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...Elevation.low,
  },
  submitText: {
    fontSize: 15,
    fontWeight: '700',
  },
  spacer: {
    height: Spacing.four,
  },
});
