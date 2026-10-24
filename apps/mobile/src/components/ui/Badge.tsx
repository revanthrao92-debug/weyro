import { Text, View } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'min-w-[20px] h-5 rounded-full px-1 items-center justify-center overflow-hidden',
  {
    variants: {
      tone: {
        accent: 'bg-primary',
        neutral: 'bg-secondary',
      },
    },
    defaultVariants: { tone: 'accent' },
  }
);

const badgeTextVariants = cva('text-[11px] font-medium', {
  variants: {
    tone: {
      accent: 'text-primary-foreground',
      neutral: 'text-muted-foreground',
    },
  },
  defaultVariants: { tone: 'accent' },
});

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  /** Count or short label to display. */
  value: number | string;
}

/**
 * Small count/label badge (e.g. unread notifications) — RNR pattern
 * (cva + NativeWind). Not used as the sole carrier of meaning — always
 * paired with context at the call site.
 */
export function Badge({ value, tone = 'accent' }: BadgeProps) {
  const t = tone === 'neutral' ? ('neutral' as const) : ('accent' as const);
  return (
    <View
      className={cn(badgeVariants({ tone: t }))}
      accessibilityRole="text"
      accessibilityLabel={`Badge: ${value}`}
    >
      <Text className={cn(badgeTextVariants({ tone: t }))} maxFontSizeMultiplier={2}>
        {String(value)}
      </Text>
    </View>
  );
}

export default Badge;
