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

/**
 * テキストだけの小さなボタン（「削除」「編集」など）に付けるタップ判定の余白。
 * Apple のヒューマンインターフェイスガイドラインは 44×44pt を推奨するが、
 * 見た目までそのサイズにすると画面が窮屈になるため、当たり判定だけを広げる。
 * fontSize 12〜13 のテキストは実高さ 15〜18pt 程度なので、上下に 14 足して 44 前後を確保する。
 *
 * 左右をほとんど広げていないのは意図的。これらのボタンは横並びの行に置かれており
 * （taskActions / statusRow / moveRow など、最小の間隔は 6pt）、左右に広げると
 * 隣のボタンと当たり判定が重なる。「押したつもりのない方が反応する」ほうが、
 * ターゲットがやや狭いことより有害なため、縦方向だけで稼ぐ。
 */
export const hitSlop = { top: 14, bottom: 14, left: 2, right: 2 };
