import { ActivityIndicator, Pressable, Text, ViewStyle } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { palette } from '@/theme';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md px-4 py-3 min-h-[48px] min-w-[44px]',
  {
    variants: {
      variant: {
        primary: 'bg-primary active:bg-primary-pressed',
        secondary: 'border border-strong bg-card active:bg-accent',
        destructive: 'bg-destructive active:bg-destructive/90',
      },
      disabled: {
        true: 'opacity-50',
        false: '',
      },
    },
    defaultVariants: { variant: 'primary', disabled: false },
  }
);

// Label matches typography.bodyMedium: 16/24 medium (was 14 — shrank in the port).
const buttonTextVariants = cva('text-base font-medium text-center', {
  variants: {
    variant: {
      primary: 'text-primary-foreground',
      secondary: 'text-foreground',
      destructive: 'text-destructive-foreground',
    },
  },
  defaultVariants: { variant: 'primary' },
});

const SPINNER_COLOR = {
  primary: palette.onAccent,
  secondary: palette.accent,
  destructive: palette.onDanger,
} as const;

export interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
  accessibilityLabel?: string;
  loading?: boolean;
  /** Optional extra style (merged after the class-based base). */
  style?: ViewStyle | ViewStyle[];
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive';

function mapVariant(variant: VariantProps<typeof buttonVariants>['variant'] | null | undefined): ButtonVariant {
  return variant === 'secondary' || variant === 'destructive' ? variant : 'primary';
}

/**
 * Primary action control — React Native Reusables pattern (cva + NativeWind
 * classes) behind the original props signature (title, onPress, disabled,
 * variant, accessibilityLabel, loading, style). ≥48px touch target.
 */
export function Button({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  loading,
  style,
}: ButtonProps) {
  const isDisabled = disabled || !!loading;
  const v = mapVariant(variant);

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: !!loading }}
      className={cn(buttonVariants({ variant: v, disabled: isDisabled }))}
      style={style}
    >
      {loading ? (
        <ActivityIndicator
          color={SPINNER_COLOR[v]}
          accessibilityLabel="Loading"
        />
      ) : (
        <Text className={buttonTextVariants({ variant: v })} maxFontSizeMultiplier={2}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export default Button;
