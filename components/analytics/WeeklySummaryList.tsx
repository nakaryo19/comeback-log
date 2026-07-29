import { StyleSheet, Text, View } from "react-native";
import { formatShortDate } from "../../lib/date";
import type { WeeklyStat } from "../../lib/insights/weeklyStats";
import { colors, radius, shadow, spacing } from "../../lib/theme";

/**
 * 週ごとの達成率・平均感情スコアの一覧（要件定義書 4-3 層2）。
 *
 * 新しい週を上に並べる。振り返りは直近から遡るのが自然で、
 * 古い順だと毎回いちばん下までスクロールしてから読むことになるため。
 *
 * ハイライト（好調週バッジ等）はここに載せる想定だが、判定には最低4週間分の
 * データが要る（要件定義書 4-3）。数値の一覧を先に用意し、判定は別途実装する。
 */
export function WeeklySummaryList({ weeks }: { weeks: WeeklyStat[] }) {
  const rows = [...weeks].reverse();

  return (
    <View style={styles.card}>
      <Text style={styles.title}>週ごとの記録</Text>
      <Text style={styles.subtitle}>達成率と、その週の平均的な気持ち</Text>

      {rows.map((week) => (
        <View key={week.start} style={styles.row}>
          <Text style={styles.range}>
            {formatShortDate(week.start)} 〜 {formatShortDate(week.end)}
          </Text>
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
  range: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
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
