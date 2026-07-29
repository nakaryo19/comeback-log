import { StyleSheet, Text, View } from "react-native";
import { formatShortDate } from "../../lib/date";
import { EMOTION_TAGS, TAG_COLORS } from "../../lib/insights/tags";
import type { WeeklyStat } from "../../lib/insights/weeklyStats";
import { colors, radius, shadow, spacing } from "../../lib/theme";

const PLOT_HEIGHT = 120;

/**
 * 感情タグの週別出現数を積み上げ棒グラフで表示する（要件定義書 4-3 層2）。
 *
 * DailyTrendChart と同じくチャートライブラリを使わず View だけで描く。
 * 積み上げは高さの比率だけで表せるため、実寸の測定（onLayout）も要らない。
 */
export function TagTrendChart({ weeks }: { weeks: WeeklyStat[] }) {
  const totals = weeks.map((week) =>
    EMOTION_TAGS.reduce((sum, tag) => sum + week.tagCounts[tag], 0),
  );
  const max = Math.max(...totals);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>感情タグの推移</Text>
      <Text style={styles.subtitle}>週ごとに、どんな気持ちを多く記録したか</Text>

      {max === 0 ? (
        <Text style={styles.empty}>タグを付けた記録がまだありません</Text>
      ) : (
        <>
          <View style={styles.plot}>
            {weeks.map((week, index) => (
              <View key={week.start} style={styles.column}>
                <View style={styles.stack}>
                  {/*
                    積み上げの順序は EMOTION_TAGS の並びに固定する。週ごとに多い順へ
                    並べ替えると、同じタグが週によって上下に動いて推移が読めなくなる。
                  */}
                  {EMOTION_TAGS.map((tag) => {
                    const count = week.tagCounts[tag];
                    if (count === 0) return null;
                    return (
                      <View
                        key={tag}
                        accessibilityRole="text"
                        accessibilityLabel={`${formatShortDate(week.start)}の週：${tag} ${count}件`}
                        style={{
                          height: (count / max) * PLOT_HEIGHT,
                          backgroundColor: TAG_COLORS[tag],
                        }}
                      />
                    );
                  })}
                </View>
                <Text style={styles.countLabel}>{totals[index] || ""}</Text>
                <Text style={styles.weekLabel}>{formatShortDate(week.start)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.legend}>
            {EMOTION_TAGS.map((tag) => (
              <View key={tag} style={styles.legendItem}>
                <View style={[styles.legendChip, { backgroundColor: TAG_COLORS[tag] }]} />
                <Text style={styles.legendText}>{tag}</Text>
              </View>
            ))}
          </View>
        </>
      )}
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
    marginBottom: spacing.lg,
  },
  empty: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  plot: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  column: {
    flex: 1,
    alignItems: "center",
  },
  stack: {
    width: "62%",
    height: PLOT_HEIGHT,
    // 下から積み上げる。上端を揃えると、棒が短い週の位置がばらついて比較できなくなる
    justifyContent: "flex-end",
    borderRadius: 3,
    overflow: "hidden",
  },
  countLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  weekLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendChip: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
