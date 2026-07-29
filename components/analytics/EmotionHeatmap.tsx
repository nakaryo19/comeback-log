import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  currentMonthString,
  formatMonthLabel,
  monthDateStrings,
  shiftMonthString,
  weekStartString,
  type ISOMonthString,
} from "../../lib/date";
import { buildDailyStats, type DailyStat } from "../../lib/insights/dailyStats";
import { fetchEmotionScoresByTaskId } from "../../lib/supabase/emotionLogs";
import { fetchTasksForDateRange } from "../../lib/supabase/tasks";
import { colors, hitSlop, radius, shadow, spacing } from "../../lib/theme";

const WEEKDAY_HEADERS = ["月", "火", "水", "木", "金", "土", "日"];

/**
 * 感情スコア 1〜5 に対応する青の濃淡（要件定義書 4-3 層2）。
 * 記録が無い日は灰色にする。薄い青にすると「スコアが低かった日」と見分けが付かないため。
 */
const SCORE_COLORS = ["#DBEAFE", "#BFDBFE", "#93C5FD", "#60A5FA", "#3B82F6"];
const NO_RECORD_COLOR = "#F3F4F6";

/** 濃い青の上では黒文字が読めなくなるため、上位2段階だけ白文字にする */
function cellTextColor(score: number | null): string {
  if (score === null) return colors.textMuted;
  return score >= 4 ? colors.white : colors.textPrimary;
}

function cellColor(score: number | null): string {
  if (score === null) return NO_RECORD_COLOR;
  // 平均値は小数になるので、四捨五入して 1〜5 の段階に落とす
  return SCORE_COLORS[Math.min(4, Math.max(0, Math.round(score) - 1))];
}

/**
 * 1ヶ月分の感情スコアを色の濃淡で俯瞰するカレンダー（要件定義書 4-3 層2）。
 *
 * 月ごとに独立して取得する。前後の月へ移動できるようにするため、
 * 画面全体で1回だけ取得する作りにすると、移動のたびに親まで巻き込んで再取得になる。
 */
export function EmotionHeatmap() {
  const thisMonth = currentMonthString();
  const [month, setMonth] = useState<ISOMonthString>(thisMonth);
  // 取得結果には対象月を添えて持つ。月を切り替えた直後に「読み込み中」へ戻すために
  // effect の中で null を入れ直すと、同期的な setState で描画が余分に走るため、
  // 表示中の月と一致しないことをもって未取得と判断する。
  const [loaded, setLoaded] = useState<{ month: ISOMonthString; stats: DailyStat[] } | null>(null);
  const stats = loaded?.month === month ? loaded.stats : null;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const dates = monthDateStrings(month);
      const tasks = await fetchTasksForDateRange(dates[0], dates[dates.length - 1]);
      const scores = await fetchEmotionScoresByTaskId(tasks.map((t) => t.id));
      if (cancelled) return;
      setLoaded({ month, stats: buildDailyStats(dates, tasks, scores) });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [month]);

  // 1日が何曜日かに応じて、先頭に空きマスを入れて曜日列を揃える（月曜始まり）
  const firstDate = `${month}-01`;
  const leadingBlanks = Math.round(
    (Date.parse(firstDate) - Date.parse(weekStartString(firstDate))) / 86400000,
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>感情スコアのカレンダー</Text>
        <View style={styles.monthNav}>
          <TouchableOpacity
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="前の月"
            onPress={() => setMonth(shiftMonthString(month, -1))}
          >
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{formatMonthLabel(month)}</Text>
          <TouchableOpacity
            hitSlop={hitSlop}
            accessibilityRole="button"
            accessibilityLabel="次の月"
            // 未来の月には移動できない。まだ来ていない日ばかりの空カレンダーを見せても意味がないため
            disabled={month >= thisMonth}
            onPress={() => setMonth(shiftMonthString(month, 1))}
          >
            <Text style={[styles.navArrow, month >= thisMonth && styles.navArrowDisabled]}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.grid}>
        {WEEKDAY_HEADERS.map((label) => (
          <View key={label} style={styles.cellSlot}>
            <Text style={styles.weekdayHeader}>{label}</Text>
          </View>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} style={styles.cellSlot} />
        ))}

        {(stats ?? []).map((stat) => (
          <View key={stat.date} style={styles.cellSlot}>
            <View
              accessibilityRole="text"
              accessibilityLabel={
                stat.averageScore === null
                  ? `${Number(stat.date.slice(8, 10))}日：感情の記録なし`
                  : `${Number(stat.date.slice(8, 10))}日：平均スコア ${stat.averageScore}`
              }
              style={[styles.cell, { backgroundColor: cellColor(stat.averageScore) }]}
            >
              <Text style={[styles.cellText, { color: cellTextColor(stat.averageScore) }]}>
                {Number(stat.date.slice(8, 10))}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {stats === null && <Text style={styles.loading}>読み込み中...</Text>}

      <View style={styles.legend}>
        <Text style={styles.legendText}>低</Text>
        {SCORE_COLORS.map((color) => (
          <View key={color} style={[styles.legendChip, { backgroundColor: color }]} />
        ))}
        <Text style={styles.legendText}>高</Text>
        <View style={[styles.legendChip, styles.legendGap, { backgroundColor: NO_RECORD_COLOR }]} />
        <Text style={styles.legendText}>記録なし</Text>
      </View>
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
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  navArrow: {
    fontSize: 20,
    lineHeight: 22,
    color: colors.primary,
    paddingHorizontal: spacing.sm,
  },
  navArrowDisabled: {
    color: colors.border,
  },
  monthLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
    minWidth: 88,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  // 7列を確実に折り返すため、割合で幅を決める（端末幅に依存させない）
  cellSlot: {
    width: `${100 / 7}%`,
    padding: 2,
  },
  cell: {
    aspectRatio: 1,
    borderRadius: radius.sm - 4,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayHeader: {
    fontSize: 10,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  cellText: {
    fontSize: 11,
    fontWeight: "500",
  },
  loading: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  legendChip: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendGap: {
    marginLeft: spacing.md,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
