/**
 * 共通デザイントークン。
 * 感情ログを扱うアプリのため、評価的・警戒色（強い赤等）は避け、
 * 落ち着いたトーンで統一する（CLAUDE.md「不調検出の表現トーンに注意する」の精神を平常時のUIにも適用）。
 */
export const colors = {
  background: "#F9FAFB",
  surface: "#FFFFFF",
  border: "#E5E7EB",
  borderLight: "#F0F1F3",

  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",

  primary: "#6366F1",
  primaryDark: "#4338CA",
  primaryMuted: "#EEF2FF",

  success: "#10B981",
  successMuted: "#ECFDF5",
  warning: "#F59E0B",
  warningMuted: "#FFFBEB",
  neutral: "#9CA3AF",
  neutralMuted: "#F3F4F6",

  danger: "#DC2626",
  dangerMuted: "#FEF2F2",

  white: "#FFFFFF",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const shadow = {
  card: {
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
};
