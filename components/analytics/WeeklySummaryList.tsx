import { StyleSheet, Text, View } from "react-native";
import { formatShortDate } from "../../lib/date";
import type { WeekHighlight } from "../../lib/insights/highlights";
import type { WeeklyStat } from "../../lib/insights/weeklyStats";
import { colors, radius, shadow, spacing } from "../../lib/theme";

/**
 * 週ごとの達成率・平均感情スコアの一覧（要件定義書 4-3 層2）。
 *
 * 新しい週を上に並べる。振り返りは直近から遡るのが自然で、
 * 古い順だと毎回いちばん下までスクロールしてから読むことになるため。
 *
 * 好調週にだけバッジを付ける。下位の週にはここでは何も表示しない（要件定義書 4-3）。
 * 一覧の行に印を付けると、並んだ週の中で「印の付いた週」として目立ってしまい、
 * 労いのつもりの表示が指摘として読まれる。下位の週は別の労いカードで1つだけ扱う。
 */
export function WeeklySummaryList({
  weeks,
  highlights,
}: {
  weeks: WeeklyStat[];
  /** 週の開始日 -> ハイライト区分。データが4週未満のときは空 */
  highlights?: Map<string, WeekHighlight>;
}) {
  const rows = [...weeks].reverse();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>週ごとの記録</Text>
      <Text style={styles.subtitle}>達成率と、その週の平均的な気持ち</Text>

      {rows.map((week) => (
        <View key={week.start} style={styles.row}>
          <View style={styles.rangeColumn}>
            <Text style={styles.range}>
              {formatShortDate(week.start)} 〜 {formatShortDate(week.end)}
            </Text>
            {highlights?.get(week.start) === "good" && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>★ 好調週</Text>
              </View>
            )}
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {week.achievementRate === null ? "－" : `${week.achievementRate}%`}
            </Text>
            <Text style={styles.metricLabel}>
              {week.totalCount === 0 ? "達成率" : `${week.completedCount}/${week.totalCount} 件`}
            </Text>
          </View>
          <View style={styles.metric}>
            <Text style={styles.metricValue}>
              {week.averageScore === null ? "－" : week.averageScore}
            </Text>
            <Text style={styles.metricLabel}>平均スコア</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rangeColumn: {
    flex: 1,
  },
  range: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  // 金色や強い黄は使わない。アプリ全体の基調色をそのまま薄く使い、
  // 「特別な評価」ではなく「その週の目印」として置く（CLAUDE.md 表現トーン）
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.primaryDark,
  },
  metric: {
    width: 74,
    alignItems: "flex-end",
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
});
