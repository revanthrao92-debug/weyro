import { TextInput, TextInputProps } from 'react-native';

export interface InputProps extends Omit<TextInputProps, 'autoCompleteType'> {
  autoCompleteType?: string;
  label?: string;
  error?: string;
}

export function Input({ label, error, autoCompleteType, ...props }: InputProps) {
  return (
    <TextInput
      {...(props as any)}
      autoCompleteType={autoCompleteType}
      editable={props.editable !== false}
    />
  );
}
