import { StyleSheet, Text, View } from "react-native";
import { formatShortDate } from "../../lib/date";
import { GENTLE_MESSAGE, type Highlights } from "../../lib/insights/highlights";
import { colors, radius, spacing } from "../../lib/theme";

/**
 * ハイライト表示（要件定義書 4-3）。
 *
 * 労いのカードと、タスク量×感情のパターンを並べる。
 *
 * 表現のトーンについて（CLAUDE.md「不調検出の表現トーンに注意する」）：
 * - 「不調」「低調」といった評価語を使わない
 * - アラート色（赤・強い黄）を使わない。背景は無彩色、文字は控えめな濃度に留める
 * - 断定しない。「〜かもしれません」「〜のようです」で、観察の提示に留める
 * - アイコンや強調で目を引きに行かない。気づいた人だけが読めばよい
 *
 * データが4週間分に届かない間は、このカード自体を出さない。
 * 相対評価に母数が要るというだけでなく、始めたばかりの人に対して
 * 「あなたの調子」を語り出すのが早すぎるためでもある。
 */
export function HighlightCards({ highlights }: { highlights: Highlights }) {
  if (!highlights.hasEnoughData) return null;

  const { gentleWeek, patterns } = highlights;
  if (!gentleWeek && patterns.length === 0) return null;

  return (
    <View style={styles.container}>
      {gentleWeek && (
        <View style={styles.card}>
          <Text style={styles.period}>
            {formatShortDate(gentleWeek.start)} 〜 {formatShortDate(gentleWeek.end)}
          </Text>
          <Text style={styles.message}>{GENTLE_MESSAGE}</Text>
        </View>
      )}

      {patterns.map((pattern) => (
        <View key={pattern.id} style={styles.card}>
          <Text style={styles.period}>気づいたこと</Text>
          <Text style={styles.message}>{pattern.message}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  // 影を付けず、他のカードより一段沈ませる。
  // 数値やグラフより前に出てくると、押し付けがましくなる
  card: {
    backgroundColor: colors.neutralMuted,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  period: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.textSecondary,
  },
});
