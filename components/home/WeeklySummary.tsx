import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { currentWeekDateRange } from "../../lib/date";
import { fetchEmotionScoresForTasks } from "../../lib/supabase/emotionLogs";
import { fetchTasksForDateRange } from "../../lib/supabase/tasks";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export function WeeklySummary({ refreshKey }: { refreshKey?: unknown }) {
  const [achievementRate, setAchievementRate] = useState<number | null>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { start, end } = currentWeekDateRange();
      const tasks = await fetchTasksForDateRange(start, end);
      const scores = await fetchEmotionScoresForTasks(tasks.map((t) => t.id));
      if (cancelled) return;

      setAchievementRate(
        tasks.length === 0
          ? null
          : Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100),
      );
      setAverageScore(
        scores.length === 0
          ? null
          : Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 10) / 10,
      );
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (loading) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.value}>
          {achievementRate === null ? "－" : `${achievementRate}%`}
        </Text>
        <Text style={styles.label}>今週の達成率</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.card}>
        <Text style={styles.value}>{averageScore === null ? "－" : averageScore}</Text>
        <Text style={styles.label}>今週の平均感情スコア</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  card: {
    flex: 1,
    alignItems: "center",
  },
  divider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.borderLight,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
