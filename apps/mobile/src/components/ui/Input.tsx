import { TextInput, TextInputProps } from 'react-native';

export interface InputProps extends Omit<TextInputProps, 'autoCompleteType'> {
  autoCompleteType?: string;
  label?: string;
  error?: string;
  accessibilityLabel?: string;
}

export function Input({ label, error, autoCompleteType, accessibilityLabel, ...props }: InputProps) {
  return (
    <TextInput
      {...(props as any)}
      autoCompleteType={autoCompleteType}
      editable={props.editable !== false}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityRole="text"
      accessibilityState={error ? { invalid: true } : undefined}
    />
  );
}
