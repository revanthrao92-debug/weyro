import { Text, View } from 'react-native';
import { AlertTriangle, MapPin } from 'lucide-react-native';
import { Chip, Input } from '@/components/ui';
import { type PickedLocation } from '@/maps';
import { addDaysISO, prettyDate, type FieldConfig } from '../serviceRequestConfig';
import { palette } from '@/theme';

import { styles } from './wizardStyles';

export function FieldBlock({
  field,
  value,
  error,
  onChange,
}: {
  field: FieldConfig;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === 'chips') {
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        <View style={styles.chipWrap}>
          {field.options?.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={value === option.value}
              onPress={() => onChange(option.value)}
            />
          ))}
        </View>
        {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  if (field.type === 'date') {
    const quick = [
      { label: 'Today', days: 0 },
      { label: 'Tomorrow', days: 1 },
      { label: 'In 3 days', days: 3 },
      { label: 'Next week', days: 7 },
    ];
    return (
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>
          {field.label}
          {field.required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {field.future ? (
          <View style={styles.quickDates}>
            {quick.map((option) => (
              <Chip
                key={option.label}
                label={option.label}
                selected={value === addDaysISO(option.days)}
                onPress={() => onChange(addDaysISO(option.days))}
              />
            ))}
          </View>
        ) : null}
        {value ? (
          <Text style={styles.dateSummary}>
            Selected: {prettyDate(value)}
          </Text>
        ) : null}
        <Input
          label="Or enter a date"
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          error={error}
          containerStyle={styles.inputContainer}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Input
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={field.placeholder}
        error={error}
        containerStyle={styles.inputContainer}
        multiline={field.type === 'textarea'}
        numberOfLines={field.type === 'textarea' ? 4 : undefined}
        keyboardType={field.type === 'number' ? 'number-pad' : 'default'}
        maxLength={field.maxLength}
        autoCapitalize={field.type === 'number' ? 'none' : 'sentences'}
        style={field.type === 'textarea' ? styles.textarea : undefined}
      />
      {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
    </View>
  );
}

export function SavedPlace({
  place,
  detail,
}: {
  place: PickedLocation;
  detail: string;
}) {
  return (
    <View style={styles.savedPlace}>
      <View style={styles.savedIcon}>
        <MapPin size={15} color={palette.accent} strokeWidth={2} />
      </View>
      <View style={styles.savedText}>
        <Text style={styles.savedTitle}>
          {place.label ? `Pickup near ${place.label}` : 'Pickup location'}
        </Text>
        <Text style={styles.savedAddress}>{place.address}</Text>
        <Text style={styles.savedDetail}>{detail}</Text>
      </View>
    </View>
  );
}

export function Banner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <AlertTriangle size={15} color={palette.danger} strokeWidth={2} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}
