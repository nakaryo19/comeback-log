import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { recentWeekStarts, shiftDateString } from "../../lib/date";
import { buildWeeklyStats, type WeeklyStat } from "../../lib/insights/weeklyStats";
import { fetchEmotionEntriesByTaskId } from "../../lib/supabase/emotionLogs";
import { fetchTasksForDateRange } from "../../lib/supabase/tasks";
import { colors, hitSlop, radius, spacing } from "../../lib/theme";
import { EmotionHeatmap } from "./EmotionHeatmap";
import { TagTrendChart } from "./TagTrendChart";
import { WeeklySummaryList } from "./WeeklySummaryList";

/**
 * 週次サマリーとタグ推移が遡る週数。
 * ハイライト判定に要る最低4週間（要件定義書 4-3）を上回りつつ、
 * 1画面に並ぶ棒が細くなりすぎない範囲として8週にしている。
 */
const WEEKS = 8;

/**
 * 詳細分析画面（要件定義書 4-3 層2）。
 *
 * 週次サマリーリストとタグ推移グラフは同じ期間の同じデータから作れるため、
 * ここで1回だけ取得して両方に渡す。子側でそれぞれ取得すると、同じ問い合わせが二重に走る。
 * カレンダーヒートマップだけは月単位で前後に移動できるので、取得を自分で持つ。
 */
export function AnalyticsScreen({ onBack }: { onBack: () => void }) {
  const [weeks, setWeeks] = useState<WeeklyStat[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const weekStarts = recentWeekStarts(WEEKS);
        const start = weekStarts[0];
        const end = shiftDateString(weekStarts[weekStarts.length - 1], 6);
        const tasks = await fetchTasksForDateRange(start, end);
        const entries = await fetchEmotionEntriesByTaskId(tasks.map((t) => t.id));
        if (cancelled) return;
        setWeeks(buildWeeklyStats(weekStarts, tasks, entries));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "分析データの取得に失敗しました。");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>詳しく見る</Text>
            <Text style={styles.title}>振り返り</Text>
          </View>
          <TouchableOpacity style={styles.backButton} hitSlop={hitSlop} onPress={onBack}>
            <Text style={styles.backButtonText}>ホームへ</Text>
          </TouchableOpacity>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <EmotionHeatmap />

        {weeks === null ? (
          <Text style={styles.loading}>読み込み中...</Text>
        ) : (
          <>
            <WeeklySummaryList weeks={weeks} />
            <TagTrendChart weeks={weeks} />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  backButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  loading: {
    color: colors.textMuted,
    textAlign: "center",
  },
});
