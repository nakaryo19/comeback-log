import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { currentWeekDateRange, shiftDateString, todayDateString } from "../../lib/date";
import { currentStreak, STREAK_LOOKBACK_DAYS } from "../../lib/insights/streak";
import { fetchActiveDates } from "../../lib/supabase/activity";
import { fetchEmotionScoresForTasks } from "../../lib/supabase/emotionLogs";
import { fetchTasksForDateRange } from "../../lib/supabase/tasks";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export function WeeklySummary({ refreshKey }: { refreshKey?: unknown }) {
  const [achievementRate, setAchievementRate] = useState<number | null>(null);
  const [averageScore, setAverageScore] = useState<number | null>(null);
  const [streak, setStreak] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const today = todayDateString();
      const { start, end } = currentWeekDateRange();
      const allTasks = await fetchTasksForDateRange(start, end);
      const scores = await fetchEmotionScoresForTasks(allTasks.map((t) => t.id));
      // 継続日数は今日を含めず昨日で途切れる場合があるため、さかのぼる起点は今日
      const activeDates = await fetchActiveDates(
        shiftDateString(today, -STREAK_LOOKBACK_DAYS),
        today,
      );
      if (cancelled) return;

      setStreak(currentStreak(activeDates, today));

      // まだ来ていない日の予定は達成率の分母に入れない。
      // 先の予定を登録した瞬間に達成率が下がると、記録すること自体が罰になってしまうため。
      const tasks = allTasks.filter((t) => t.date <= today);

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
        {/* 5点満点であることが分かるよう分母を添える（スコアだけでは満点が読み取れないため） */}
        <Text style={styles.value}>
          {averageScore === null ? (
            "－"
          ) : (
            <>
              {averageScore}
              <Text style={styles.valueSuffix}> / 5</Text>
            </>
          )}
        </Text>
        <Text style={styles.label}>今週の平均感情スコア</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.card}>
        {/* 途切れているときは 0 ではなく「－」。他の2つの未記録時と同じ見え方に揃え、
            0 という数字を突きつけない（要件定義書 4-3 の表現トーンに合わせる） */}
        <Text style={styles.value}>
          {streak === null ? (
            "－"
          ) : (
            <>
              {streak}
              <Text style={styles.valueSuffix}>日</Text>
            </>
          )}
        </Text>
        <Text style={styles.label}>継続日数</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    // stretch にして3枚の高さを揃える。ラベルの行数が違う（「今週の平均感情スコア」だけ
    // 狭幅で2行になる）ため、center のままだと数値の高さがカードごとにずれる
    alignItems: "stretch",
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  card: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.xs,
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
  valueSuffix: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textMuted,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: "center",
  },
});
