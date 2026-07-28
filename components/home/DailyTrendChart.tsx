import { useEffect, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import { recentDateStrings, weekdayLabel } from "../../lib/date";
import { buildDailyStats, type DailyStat } from "../../lib/insights/dailyStats";
import { fetchEmotionScoresByTaskId } from "../../lib/supabase/emotionLogs";
import { fetchTasksForDateRange } from "../../lib/supabase/tasks";
import { colors, radius, shadow, spacing } from "../../lib/theme";

/** 直近7日（今日を含む）。要件定義書 4-3 層1 */
const DAYS = 7;

const SCORE_MIN = 1;
const SCORE_MAX = 5;
const PLOT_HEIGHT = 150;
const DOT_SIZE = 9;
const LINE_WIDTH = 2;
const Y_AXIS_WIDTH = 18;

/**
 * 直近7日の推移（棒＝完了タスク数、折れ線＝感情スコア）。
 *
 * 横軸を日付にしているのは、このアプリの差別化ポイントが
 * 「タスク実績と感情ログを同じ時間軸に紐づけて可視化する」ことだから（要件定義書 3）。
 * 当初の要件（4-3）は相関散布図だったが、散布図は時間軸を捨てるため
 * 「詰め込んだ翌日に落ちる」といった前後関係が原理的に読めない。
 * 7点では相関も視認できず、感情ログの無い日は点にすらならないため、日次の推移に変更した。
 *
 * 縦軸の目盛り（1〜5）は感情スコアのもの。棒は完了数の相対的な大小を示すだけで
 * この目盛りには対応しないため、正確な件数は軸の下に数字で併記する。
 * 1つの枠に2つの尺度を描くと誤読を招くので、数値を読む側は必ず数字で出す。
 *
 * チャートライブラリを入れずに View だけで描いている。日数7・軸固定という規模では
 * ライブラリが解決する問題が起きない一方、Skia 等の重いネイティブ依存は
 * Web/iOS/Android を単一コードベースで維持する構成で最も壊れやすい部分になるため。
 */
export function DailyTrendChart({ refreshKey }: { refreshKey?: unknown }) {
  const [stats, setStats] = useState<DailyStat[] | null>(null);
  // 折れ線は線分を回転させて描くため、割合ではなく実寸が要る
  const [plotWidth, setPlotWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const dates = recentDateStrings(DAYS);
      const tasks = await fetchTasksForDateRange(dates[0], dates[dates.length - 1]);
      const scores = await fetchEmotionScoresByTaskId(tasks.map((t) => t.id));
      if (cancelled) return;
      setStats(buildDailyStats(dates, tasks, scores));
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (stats === null) return null;

  // 完了0件が続いても棒が消えないよう、棒の基準となる上限には下限を設ける
  const countMax = Math.max(3, ...stats.map((s) => s.completedCount));
  const columnWidth = plotWidth / stats.length;

  function handleLayout(event: LayoutChangeEvent) {
    setPlotWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>直近7日の記録</Text>
      <Text style={styles.subtitle}>完了したタスクの数と、その日の気持ち</Text>

      <View style={styles.chartRow}>
        <View style={styles.yAxis}>
          {[SCORE_MAX, 4, 3, 2, SCORE_MIN].map((score) => (
            <Text key={score} style={styles.axisLabel}>
              {score}
            </Text>
          ))}
        </View>

        <View style={styles.plot} onLayout={handleLayout}>
          {[SCORE_MIN, 2, 3, 4, SCORE_MAX].map((score) => (
            <View key={score} style={[styles.gridLine, { bottom: scoreToY(score) }]} />
          ))}

          {/* 棒（完了タスク数）。折れ線より先に描いて背面に置く */}
          <View style={styles.barRow}>
            {stats.map((stat) => (
              <View key={stat.date} style={styles.barColumn}>
                <View
                  style={[
                    styles.bar,
                    { height: (stat.completedCount / countMax) * PLOT_HEIGHT },
                  ]}
                />
              </View>
            ))}
          </View>

          {columnWidth > 0 &&
            buildLineSegments(stats, columnWidth).map((segment) => (
              <View
                key={segment.key}
                style={[
                  styles.line,
                  {
                    left: segment.left,
                    bottom: segment.bottom,
                    width: segment.length,
                    transform: [{ rotate: `${segment.angle}deg` }],
                  },
                ]}
              />
            ))}

          {/*
            点は列のレイアウトに任せて中央寄せする。実寸を測ってから置く作りにすると、
            onLayout が走らない環境（テストなど）で点が消え、描画を検証できなくなる。
            実寸が要るのは線分だけに留める。
          */}
          <View style={styles.dotRow} pointerEvents="none">
            {stats.map((stat) => (
              <View key={stat.date} style={styles.dotColumn}>
                {stat.averageScore !== null && (
                  <View
                    accessibilityRole="image"
                    accessibilityLabel={`${monthDay(stat.date)}：完了 ${stat.completedCount} 件、平均スコア ${stat.averageScore}`}
                    style={[styles.dot, { bottom: scoreToY(stat.averageScore) - DOT_SIZE / 2 }]}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 棒は縦軸の目盛り（感情スコア）に対応しないため、件数は数字で読ませる */}
      <View style={styles.labelRow}>
        {stats.map((stat) => (
          <View key={stat.date} style={styles.labelColumn}>
            <Text style={styles.countLabel}>{stat.completedCount}</Text>
            <Text style={styles.dateLabel}>{dayOfMonth(stat.date)}</Text>
            {/*
              曜日は日付の横ではなく下に置く。7列を狭い画面に収める必要があるため、
              「22日（火）」のように横へ伸ばすと文字が詰まる。縦に積めば列幅は "22日" のままで済む。
            */}
            <Text style={styles.weekdayLabel}>{weekdayLabel(stat.date)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={styles.legendBar} />
          <Text style={styles.legendText}>完了タスク数</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendLine} />
          <View style={styles.legendDot} />
          <Text style={styles.legendText}>感情スコア（5点満点）</Text>
        </View>
      </View>
    </View>
  );
}

/** スコア 1〜5 を、プロット領域の下端からの高さ（px）に変換する */
function scoreToY(score: number): number {
  return ((score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * PLOT_HEIGHT;
}

function columnCenter(index: number, columnWidth: number): number {
  return (index + 0.5) * columnWidth;
}

/**
 * 横軸の日付ラベル（例: "22日"）。
 * 数字だけだと、すぐ上に並ぶ完了件数の数字と見分けがつかないため「日」を付ける。
 */
function dayOfMonth(date: string): string {
  return `${Number(date.slice(8, 10))}日`;
}

function monthDay(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

type LineSegment = {
  key: string;
  left: number;
  bottom: number;
  length: number;
  angle: number;
};

/**
 * 隣り合う「感情スコアのある日」同士を結ぶ線分を求める。
 *
 * 記録の無い日を飛び越えて線を引くと、書いていない日の気持ちを勝手に補間した図になる。
 * 隣接する日だけを結び、間が空いたところは線を切る。
 */
export function buildLineSegments(stats: DailyStat[], columnWidth: number): LineSegment[] {
  const segments: LineSegment[] = [];

  for (let i = 0; i < stats.length - 1; i++) {
    const from = stats[i];
    const to = stats[i + 1];
    if (from.averageScore === null || to.averageScore === null) continue;

    const x1 = columnCenter(i, columnWidth);
    const x2 = columnCenter(i + 1, columnWidth);
    const y1 = scoreToY(from.averageScore);
    const y2 = scoreToY(to.averageScore);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);

    segments.push({
      key: `${from.date}-${to.date}`,
      // 中点に置いてから回転させる（回転の原点が中心なので、端揃えだとずれる）
      left: (x1 + x2) / 2 - length / 2,
      bottom: (y1 + y2) / 2 - LINE_WIDTH / 2,
      length,
      // bottom は上向き、回転は時計回りが正のため符号を反転する
      angle: (-Math.atan2(dy, dx) * 180) / Math.PI,
    });
  }

  return segments;
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
  chartRow: {
    flexDirection: "row",
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    // 目盛りの文字（lineHeight 12）の中心を罫線に合わせるため、上下に半行ぶん食い込ませる
    height: PLOT_HEIGHT + 12,
    marginTop: -6,
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingRight: spacing.xs,
  },
  plot: {
    flex: 1,
    height: PLOT_HEIGHT,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.borderLight,
  },
  barRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
  },
  bar: {
    width: "46%",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    backgroundColor: colors.primaryMuted,
  },
  line: {
    position: "absolute",
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: colors.primary,
    opacity: 0.55,
  },
  dotRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
  },
  dotColumn: {
    flex: 1,
    alignItems: "center",
  },
  dot: {
    position: "absolute",
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: colors.primary,
  },
  labelRow: {
    flexDirection: "row",
    marginLeft: Y_AXIS_WIDTH,
    marginTop: spacing.xs,
  },
  labelColumn: {
    flex: 1,
    alignItems: "center",
  },
  countLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  dateLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 1,
  },
  weekdayLabel: {
    fontSize: 10,
    color: colors.textMuted,
  },
  axisLabel: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 12,
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
  legendBar: {
    width: 9,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.primaryMuted,
  },
  legendLine: {
    width: 12,
    height: LINE_WIDTH,
    borderRadius: LINE_WIDTH / 2,
    backgroundColor: colors.primary,
    opacity: 0.55,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginLeft: -6,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
