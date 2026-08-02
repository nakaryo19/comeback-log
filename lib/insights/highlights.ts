/**
 * ハイライト判定（要件定義書 4-3「ハイライト表示のルール設計」）。
 *
 * 週次の複合スコアから好調週／労いの対象週を相対評価で選び、
 * タスク量と感情の前後関係からパターンを検出する。
 *
 * すべてルールベース（統計処理＋条件分岐＋固定テンプレート文）で、
 * 文言は定数として持つ。外部AI APIは呼ばない（CLAUDE.md）。
 *
 * 表現のトーンについて（CLAUDE.md「不調検出の表現トーンに注意する」）：
 * 下位の週を "bad" ではなく "gentle" と呼んでいるのは、この判定の目的が
 * 評価ではなく労いだからである。型名にも評価的な語を持ち込むと、
 * 後から UI を書く人が「悪い週」を表現しようとしてしまう。
 */
import { shiftDateString } from "../date";
import type { DailyStat } from "./dailyStats";
import type { WeeklyStat } from "./weeklyStats";
import type { ISODateString } from "../../types/database";

/**
 * 判定に使う閾値。実データを見てから調整できるよう1箇所にまとめる
 * （要件定義書 4-3「重みは後で調整可能な設計にする」）。
 */
export const HIGHLIGHT_RULES = {
  /** これを下回る間はハイライト自体を出さない。相対評価には母数が要るため */
  minWeeks: 4,
  /**
   * 順位付けの対象にする、週あたりの最低タスク数。
   *
   * 対象が3件しかない週は、1件やり残しただけで達成率が67%になる。
   * 実質1件の差で順位が決まってしまい、「その週がどうだったか」を表さない。
   * 実データでも、平均感情スコアが最も高い週が達成率だけで最下位になる例が出た。
   *
   * 逆に、この値を上げすぎると記録量の少ない人にハイライトが一生出なくなる。
   * 週5件（1日1件弱）は、振り返る材料としての下限のつもりで置いている。
   */
  minTasksPerWeek: 5,
  /**
   * 労いの対象にするために、複合スコアが全体平均を下回っていてほしい差。
   *
   * 下位20%だけを条件にすると、全体が好調でも必ずどれかの週が選ばれる。
   * 相対評価は「順位」しか見ないため、差がほとんど無い週にも
   * 「ペースが落ちていたかも」と言ってしまう。平均との差でも足切りする。
   */
  gentleMargin: 0.05,
  /** 好調週として扱う上位の割合 */
  goodRatio: 0.2,
  /** 労いの対象として扱う下位の割合 */
  gentleRatio: 0.2,
  /** 複合スコアの重み（達成率と平均感情スコア。合計1.0） */
  achievementWeight: 0.5,
  scoreWeight: 0.5,
  /** 「詰め込んだ日」とみなす、週平均からの超過タスク数 */
  crammingExtraTasks: 1,
  /** パターンとして認めるのに必要な週内の該当回数 */
  minOccurrences: 2,
} as const;

export type WeekHighlight = "good" | "gentle";

export type PatternId = "cramming" | "virtuous";

export type PatternInsight = {
  id: PatternId;
  /** 検出した週の開始日（月曜） */
  weekStart: ISODateString;
  message: string;
};

export type Highlights = {
  /** データが最低週数に届いているか。false のときは集計数値のみ表示する */
  hasEnoughData: boolean;
  /** 週の開始日 -> ハイライト区分 */
  byWeekStart: Map<ISODateString, WeekHighlight>;
  /** 労いのカードを出す対象の週。該当が無ければ null。表示は1つだけ（要件定義書 4-3） */
  gentleWeek: WeeklyStat | null;
  patterns: PatternInsight[];
};

/**
 * 固定テンプレート文。要件定義書 4-3 のメッセージ例をそのまま使う。
 * 断定を避けた「〜のようです」「〜かも」の形で揃えているのは、
 * これが観察の提示であって診断ではないため。
 */
const PATTERN_MESSAGES: Record<PatternId, string> = {
  cramming: "タスクを詰め込んだ翌日は、少しペースが落ちる傾向があるようです。",
  virtuous: "調子が良い日は、次の日の勢いにもつながっているようです。",
};

export const GENTLE_MESSAGE = "この週は、少しペースが落ちていたかもしれません。";

/**
 * 週の複合スコア（0〜1）。達成率と平均感情スコアを正規化して加重平均する。
 *
 * どちらか一方でも欠けている週は null を返し、順位付けの母集団から外す。
 * 感情ログを書かなかった週を「スコアが低い週」として扱うと、
 * 記録しなかったことが労いの対象になってしまい、判定の意味が変わる。
 *
 * タスクが少なすぎる週も同じく null にする（minTasksPerWeek 参照）。
 */
export function compositeScore(week: WeeklyStat): number | null {
  if (week.achievementRate === null || week.averageScore === null) return null;
  if (week.totalCount < HIGHLIGHT_RULES.minTasksPerWeek) return null;
  // 感情スコアは 1〜5。0 は存在しないため (s-1)/4 で 0〜1 に写す
  const normalizedScore = (week.averageScore - 1) / 4;
  return (
    (week.achievementRate / 100) * HIGHLIGHT_RULES.achievementWeight +
    normalizedScore * HIGHLIGHT_RULES.scoreWeight
  );
}

/** 上位／下位として扱う件数。割合をそのまま使うと母数が小さい間に該当週が0件になる */
function selectionCount(total: number, ratio: number): number {
  return Math.max(1, Math.floor(total * ratio));
}

/**
 * ハイライトを判定する。
 *
 * @param weeks 古い週から新しい週の順
 * @param dailyStats 同じ期間の日次集計（パターン検出に使う）
 */
export function buildHighlights(weeks: WeeklyStat[], dailyStats: DailyStat[]): Highlights {
  const scorable = weeks
    .map((week) => ({ week, score: compositeScore(week) }))
    .filter((entry): entry is { week: WeeklyStat; score: number } => entry.score !== null);

  const empty: Highlights = {
    hasEnoughData: false,
    byWeekStart: new Map(),
    gentleWeek: null,
    patterns: [],
  };

  if (scorable.length < HIGHLIGHT_RULES.minWeeks) return empty;

  const ranked = [...scorable].sort((a, b) => b.score - a.score);
  const goodCount = selectionCount(ranked.length, HIGHLIGHT_RULES.goodRatio);
  const gentleCount = selectionCount(ranked.length, HIGHLIGHT_RULES.gentleRatio);

  const byWeekStart = new Map<ISODateString, WeekHighlight>();
  for (const entry of ranked.slice(0, goodCount)) {
    byWeekStart.set(entry.week.start, "good");
  }
  // 平均を明確に下回っていることも条件にする。順位だけで決めると、
  // 全体が好調な期間でも必ずどれかの週に労いのカードが出てしまう
  const average = ranked.reduce((sum, entry) => sum + entry.score, 0) / ranked.length;
  const gentleThreshold = average - HIGHLIGHT_RULES.gentleMargin;

  for (const entry of ranked.slice(-gentleCount)) {
    // 母数が小さいと上位と下位が重なりうる。その場合は好調週を優先する。
    // 同じ週を「好調」と「労い」の両方で示すと、どちらを受け取ればよいか分からなくなる
    if (byWeekStart.has(entry.week.start)) continue;
    if (entry.score > gentleThreshold) continue;
    byWeekStart.set(entry.week.start, "gentle");
  }

  // 労いのカードは1つだけ。該当週が複数あるときは最も新しい週について出す
  // （何週も前のことを今さら持ち出しても、観察として役に立たないため）
  const gentleWeek =
    [...weeks].reverse().find((week) => byWeekStart.get(week.start) === "gentle") ?? null;

  return {
    hasEnoughData: true,
    byWeekStart,
    gentleWeek,
    patterns: detectPatterns(weeks, dailyStats),
  };
}

/**
 * タスク量と感情の前後関係からパターンを検出する（要件定義書 4-3）。
 *
 * 同じパターンを週の数だけ並べても読みづらいだけなので、
 * 種類ごとに最も新しい該当週の1件だけを返す。
 */
function detectPatterns(weeks: WeeklyStat[], dailyStats: DailyStat[]): PatternInsight[] {
  const statByDate = new Map(dailyStats.map((stat) => [stat.date, stat]));
  const found = new Map<PatternId, PatternInsight>();

  for (const week of weeks) {
    // 週平均のスコアが無い週は「下回る／上回る」の基準が作れない
    if (week.averageScore === null) continue;

    const days = Array.from({ length: 7 }, (_, i) => statByDate.get(shiftDateString(week.start, i)));
    if (days.some((day) => day === undefined)) continue;
    const stats = days as DailyStat[];

    const averageCompleted = stats.reduce((sum, day) => sum + day.completedCount, 0) / stats.length;
    let cramming = 0;
    let virtuous = 0;

    for (let i = 0; i < stats.length - 1; i += 1) {
      const today = stats[i];
      const next = stats[i + 1];

      // 詰め込みパターン：多くこなした日の翌日、気持ちが週平均を下回る
      if (
        today.completedCount >= averageCompleted + HIGHLIGHT_RULES.crammingExtraTasks &&
        next.averageScore !== null &&
        next.averageScore < week.averageScore
      ) {
        cramming += 1;
      }

      // 好循環パターン：気持ちが週平均を上回った日の翌日、こなした数も平均以上
      if (
        today.averageScore !== null &&
        today.averageScore > week.averageScore &&
        next.completedCount >= averageCompleted
      ) {
        virtuous += 1;
      }
    }

    if (cramming >= HIGHLIGHT_RULES.minOccurrences) {
      found.set("cramming", {
        id: "cramming",
        weekStart: week.start,
        message: PATTERN_MESSAGES.cramming,
      });
    }
    if (virtuous >= HIGHLIGHT_RULES.minOccurrences) {
      found.set("virtuous", {
        id: "virtuous",
        weekStart: week.start,
        message: PATTERN_MESSAGES.virtuous,
      });
    }
  }

  // 好循環を先に出す。両方出るとき、先に目に入るのが労いの側であってほしい
  return (["virtuous", "cramming"] as const)
    .map((id) => found.get(id))
    .filter((insight): insight is PatternInsight => insight !== undefined);
}
