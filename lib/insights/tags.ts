/**
 * 感情タグの定義。
 *
 * 入力フォーム（EmotionLogForm）と推移グラフ（TagTrendChart）の両方が参照する。
 * 別々に持つと、タグを1つ増やしたときにグラフ側から静かに消えるため、定義はここ1箇所に置く。
 */
export const EMOTION_TAGS = ["不安", "達成感", "焦り", "集中", "疲労"] as const;

export type EmotionTag = (typeof EMOTION_TAGS)[number];

/**
 * タグの表示色。
 *
 * 「焦り」「不安」を警戒色（赤）にはしない。記録した気持ちに良し悪しの色を付けないため
 * （CLAUDE.md「不調検出の表現トーンに注意する」）。彩度を揃えた同格の5色にする。
 *
 * そのうえで色相は5色に散らす。積み上げ棒グラフでは境目に線を引かないので、
 * 隣り合う色が近いと1本の帯に見えてしまう。
 */
export const TAG_COLORS: Record<EmotionTag, string> = {
  不安: "#F0ABFC",
  達成感: "#6EE7B7",
  焦り: "#FCD34D",
  集中: "#60A5FA",
  疲労: "#C4B5FD",
};

export function isEmotionTag(tag: string | null): tag is EmotionTag {
  return tag !== null && (EMOTION_TAGS as readonly string[]).includes(tag);
}
