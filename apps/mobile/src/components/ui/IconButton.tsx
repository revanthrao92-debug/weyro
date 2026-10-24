import { Pressable } from 'react-native';
import { ReactNode } from 'react';

export interface IconButtonProps {
  /** Icon element (lucide icons take size/color props). */
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
}

/**
 * Compact square icon button matching the secondary Button treatment
 * (borderStrong + card surface). 48×48 → meets the 44px touch target.
 * Static style only — NativeWind's Pressable patch drops function styles.
 */
export function IconButton({ icon, onPress, accessibilityLabel, disabled }: IconButtonProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      className="items-center justify-center rounded-md border border-strong bg-card active:bg-accent"
      style={{ width: 48, height: 48 }}
    >
      {icon}
    </Pressable>
  );
}

export default IconButton;
