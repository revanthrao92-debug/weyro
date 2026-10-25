/**
 * Shared UI component library — barrel.
 * Import components as: `import { Button, Card } from '@/components/ui';`
 * All components consume theme tokens only (no hardcoded colors/magic numbers).
 */

export { ScreenContainer, Card } from './ScreenContainer';
export type { ScreenContainerProps, CardProps } from './ScreenContainer';

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { AppHeader } from './AppHeader';
export type { AppHeaderProps } from './AppHeader';

export { BackButton } from './BackButton';
export type { BackButtonProps } from './BackButton';

export { FilterBar } from './FilterBar';
export type { FilterBarProps } from './FilterBar';

export { IconButton } from './IconButton';
export type { IconButtonProps } from './IconButton';

export { SectionHeader } from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';

export { SectionCard } from './SectionCard';
export type { SectionCardProps } from './SectionCard';

export { PromoBanner } from './PromoBanner';
export type { PromoBannerProps } from './PromoBanner';

export { Chip, FilterChips } from './Chip';
export type { ChipProps, FilterChipsProps } from './Chip';

export { StatusPill } from './StatusPill';
export type { StatusPillProps } from './StatusPill';

export { Badge } from './Badge';
export type { BadgeProps } from './Badge';

export { ListItem } from './ListItem';
export type { ListItemProps } from './ListItem';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { ErrorState } from './ErrorState';
export type { ErrorStateProps } from './ErrorState';

export { Skeleton, SkeletonBlock } from './Skeleton';
export type { SkeletonProps } from './Skeleton';

export { Toast } from './Toast';
export type { ToastProps } from './Toast';

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { BottomSheet } from './BottomSheet';
export type { BottomSheetProps } from './BottomSheet';

export { ButtonRow } from './ButtonRow';
export type { ButtonRowProps } from './ButtonRow';

export { OfflineBanner } from './OfflineBanner';
export type { OfflineBannerProps } from './OfflineBanner';

// React Native Reusables — Dialog (compound components, vendored from the
// official NativeWind registry with adapted import paths).
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog';
