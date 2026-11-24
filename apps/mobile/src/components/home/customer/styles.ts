import { StyleSheet } from 'react-native';
import { palette, spacing, typography, displayFamily } from '@/theme';

export const styles = StyleSheet.create({
  adGap: { marginTop: spacing.xxl },
  page: { paddingBottom: 104 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  wordmark: {
    fontFamily: displayFamily,
    fontSize: 22,
    lineHeight: 24,
    color: palette.textPrimary,
    letterSpacing: -0.4,
  },
  mark: { width: 5, height: 5, backgroundColor: palette.accent, marginTop: 10 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: palette.accent,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.borderStrong,
  },
  avatarText: { ...typography.label, color: palette.textSecondary },


  body: { paddingHorizontal: spacing.lg },
  locationText: { ...typography.caption, color: palette.textSecondary, flexShrink: 1 },

  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },


  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  statusText: { flex: 1 },
  statusTitle: { ...typography.bodyMedium, color: palette.textPrimary },
  statusMeta: { ...typography.label, color: palette.textMuted, marginTop: 2 },

  bandFull: {
    height: 220,
    marginTop: spacing.xl,
    marginHorizontal: -spacing.lg,
    overflow: 'hidden',
    backgroundColor: palette.surfaceAlt,
  },
  bandImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  bandScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16, 18, 20, 0.46)',
  },
  bandContent: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  bandTitle: {
    fontFamily: displayFamily,
    fontSize: 24,
    lineHeight: 27,
    letterSpacing: -0.3,
    color: palette.onPhoto,
  },
  bandMeta: { ...typography.label, color: palette.onPhotoMuted, marginTop: 4 },
  assurance: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  assuranceRow: { paddingVertical: spacing.md },
  assuranceLabel: { ...typography.captionMedium, color: palette.textPrimary },
  assuranceDetail: { ...typography.label, color: palette.textMuted, marginTop: 2 },

});
