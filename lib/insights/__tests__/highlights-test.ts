import {
  buildHighlights,
  compositeScore,
  HIGHLIGHT_RULES,
  type WeekHighlight,
} from "../highlights";
import type { DailyStat } from "../dailyStats";
import type { WeeklyStat } from "../weeklyStats";
import { shiftDateString } from "../../date";
import { EMOTION_TAGS } from "../tags";
import type { EmotionTag } from "../tags";
import type { ISODateString } from "../../../types/database";

const FIRST_MONDAY: ISODateString = "2026-06-01";

function emptyTagCounts(): Record<EmotionTag, number> {
  return Object.fromEntries(EMOTION_TAGS.map((tag) => [tag, 0])) as Record<EmotionTag, number>;
}

/** 週インデックス（0が最も古い週）から、その週の開始日を返す */
function weekStart(index: number): ISODateString {
  return shiftDateString(FIRST_MONDAY, index * 7);
}

function week(
  index: number,
  achievementRate: number | null,
  averageScore: number | null,
): WeeklyStat {
  const start = weekStart(index);
  return {
    start,
    end: shiftDateString(start, 6),
    totalCount: achievementRate === null ? 0 : 10,
    completedCount: achievementRate === null ? 0 : Math.round(achievementRate / 10),
    achievementRate,
    averageScore,
    tagCounts: emptyTagCounts(),
  };
}

/** 指定した週について、日ごとの完了数と平均スコアを並べた日次集計を作る */
function daysOf(weekIndex: number, completed: number[], scores: (number | null)[]): DailyStat[] {
  const start = weekStart(weekIndex);
  return completed.map((completedCount, i) => ({
    date: shiftDateString(start, i),
    completedCount,
    averageScore: scores[i],
  }));
}

function highlightOf(weeks: WeeklyStat[], index: number): WeekHighlight | undefined {
  return buildHighlights(weeks, []).byWeekStart.get(weekStart(index));
}

describe("compositeScore", () => {
  test("達成率と平均スコアを 0〜1 に正規化して加重平均する", () => {
    // 達成率100% -> 1.0、スコア5 -> (5-1)/4 = 1.0
    expect(compositeScore(week(0, 100, 5))).toBe(1);
    expect(compositeScore(week(0, 0, 1))).toBe(0);
    expect(compositeScore(week(0, 50, 3))).toBeCloseTo(0.5);
  });

  test("感情ログの無い週は判定対象にしない（記録しなかったことを低評価にしない）", () => {
    expect(compositeScore(week(0, 80, null))).toBeNull();
  });

  test("対象タスクの無い週は判定対象にしない", () => {
    expect(compositeScore(week(0, null, 4))).toBeNull();
  });
});

describe("buildHighlights の最低データ量", () => {
  test("判定できる週が4週未満ならハイライトを出さない", () => {
    const weeks = [week(0, 90, 5), week(1, 20, 2), week(2, 60, 3)];

    const highlights = buildHighlights(weeks, []);

    expect(highlights.hasEnoughData).toBe(false);
    expect(highlights.byWeekStart.size).toBe(0);
    expect(highlights.gentleWeek).toBeNull();
    expect(highlights.patterns).toEqual([]);
  });

  test("週数が足りていても、判定できない週ばかりなら出さない", () => {
    const weeks = [
      week(0, 90, 5),
      week(1, 80, null),
      week(2, 70, null),
      week(3, 60, null),
      week(4, 50, null),
    ];

    expect(buildHighlights(weeks, []).hasEnoughData).toBe(false);
  });

  test("判定できる週が4週あればハイライトを出す", () => {
    const weeks = [week(0, 90, 5), week(1, 20, 2), week(2, 60, 3), week(3, 70, 4)];

    expect(buildHighlights(weeks, []).hasEnoughData).toBe(true);
  });
});

describe("好調週・労いの週の判定", () => {
  const weeks = [
    week(0, 30, 2), // 最下位
    week(1, 50, 3),
    week(2, 60, 3),
    week(3, 70, 4),
    week(4, 100, 5), // 最上位
  ];

  test("複合スコアが最も高い週を好調週にする", () => {
    expect(highlightOf(weeks, 4)).toBe("good");
  });

  test("複合スコアが最も低い週を労いの対象にする", () => {
    expect(highlightOf(weeks, 0)).toBe("gentle");
  });

  test("中間の週にはハイライトを付けない", () => {
    expect(highlightOf(weeks, 1)).toBeUndefined();
    expect(highlightOf(weeks, 2)).toBeUndefined();
    expect(highlightOf(weeks, 3)).toBeUndefined();
  });

  test("母数が小さくても、該当週が0件にならない", () => {
    // 4週 * 0.2 = 0.8。切り捨てると0件になってしまうため、最低1件は選ぶ
    const four = [week(0, 30, 2), week(1, 50, 3), week(2, 60, 3), week(3, 100, 5)];
    const highlights = buildHighlights(four, []);

    expect([...highlights.byWeekStart.values()].filter((v) => v === "good")).toHaveLength(1);
    expect([...highlights.byWeekStart.values()].filter((v) => v === "gentle")).toHaveLength(1);
  });

  test("差がほとんど無ければ、順位が最下位でも労いの対象にしない", () => {
    // 全週が同スコア。順位だけで決めると必ず1週が選ばれてしまう
    const flat = [week(0, 50, 3), week(1, 50, 3), week(2, 50, 3), week(3, 50, 3)];
    const values = [...buildHighlights(flat, []).byWeekStart.values()];

    expect(values.filter((v) => v === "gentle")).toHaveLength(0);
  });

  test("平均を明確に下回った週だけを労いの対象にする", () => {
    const weeks = [week(0, 20, 1), week(1, 90, 5), week(2, 90, 5), week(3, 90, 5)];

    expect(highlightOf(weeks, 0)).toBe("gentle");
  });

  test("同じ週が好調と労いの両方にならない", () => {
    // 判定できる週が1週だけになる状況。上位と下位の選択が同じ週を指す
    const weeks = [
      week(0, 50, 3),
      week(1, 50, 3),
      week(2, 50, 3),
      week(3, 50, 3),
      week(4, 50, 3),
    ];
    const values = [...buildHighlights(weeks, []).byWeekStart.values()];

    expect(values.filter((v) => v === "good")).toHaveLength(1);
    expect(values.filter((v) => v === "gentle")).toHaveLength(0);
  });

  test("タスクが少なすぎる週は順位付けに入れない（1件の差で順位が決まらないように）", () => {
    // 3件中2件で67%、3件中3件で100%。実質1件の差でしかない週は判定に使わない
    const sparse: WeeklyStat = { ...week(0, 67, 4.5), totalCount: 3, completedCount: 2 };

    expect(compositeScore(sparse)).toBeNull();
  });

  test("タスクが少ない週を除くと母数が足りなくなる場合はハイライトを出さない", () => {
    const weeks = [
      week(0, 60, 3),
      week(1, 60, 3),
      week(2, 60, 3),
      { ...week(3, 100, 5), totalCount: 3, completedCount: 3 },
    ];

    expect(buildHighlights(weeks, []).hasEnoughData).toBe(false);
  });

  test("労いのカードは最も新しい該当週について1つだけ返す", () => {
    // 下位2週が選ばれる状況（10週 * 0.2 = 2）を作る
    const many = [
      week(0, 10, 1),
      week(1, 20, 1),
      week(2, 60, 3),
      week(3, 60, 3),
      week(4, 60, 3),
      week(5, 60, 3),
      week(6, 60, 3),
      week(7, 60, 3),
      week(8, 90, 5),
      week(9, 95, 5),
    ];

    const highlights = buildHighlights(many, []);

    expect(highlights.gentleWeek?.start).toBe(weekStart(1));
  });
});

describe("パターン検出", () => {
  const baseWeeks = [week(0, 60, 3), week(1, 60, 3), week(2, 60, 3), week(3, 60, 3)];

  /** 4週目だけに日次データを与え、そこでの検出結果を見る */
  function patternsFor(completed: number[], scores: (number | null)[]) {
    const weeks = [...baseWeeks.slice(0, 3), week(3, 60, 3)];
    return buildHighlights(weeks, daysOf(3, completed, scores)).patterns.map((p) => p.id);
  }

  test("詰め込んだ翌日にスコアが下がる、が週内2回あれば検出する", () => {
    // 平均完了数 1.0。3件の日の翌日にスコアが週平均(3)を下回る、が2回
    const patterns = patternsFor([3, 0, 3, 0, 1, 0, 0], [3, 2, 3, 2, 3, null, null]);

    expect(patterns).toContain("cramming");
  });

  test("該当が1回だけならパターンとして扱わない", () => {
    const patterns = patternsFor([3, 0, 0, 0, 2, 0, 2], [3, 2, 3, 3, 3, 3, 3]);

    expect(patterns).not.toContain("cramming");
  });

  test("スコアが高い日の翌日に完了数が伸びる、が週内2回あれば検出する", () => {
    // 平均完了数 1.0。スコア4の日の翌日に完了数1以上、が2回
    const patterns = patternsFor([0, 2, 0, 2, 1, 1, 1], [4, 3, 4, 3, 3, 3, 3]);

    expect(patterns).toContain("virtuous");
  });

  test("両方に当てはまるときは好循環を先に返す", () => {
    const weeks = [...baseWeeks];
    const days = daysOf(3, [3, 2, 3, 2, 0, 0, 0], [4, 2, 4, 2, null, null, null]);

    const patterns = buildHighlights(weeks, days).patterns.map((p) => p.id);

    expect(patterns).toEqual(["virtuous", "cramming"]);
  });

  test("日次データが揃っていない週は検出しない（欠けた日を0として扱わない）", () => {
    const weeks = [...baseWeeks];
    const days = daysOf(3, [3, 0, 3, 0, 1, 0, 0], [3, 2, 3, 2, 3, null, null]).slice(0, 5);

    expect(buildHighlights(weeks, days).patterns).toEqual([]);
  });

  test("週の平均スコアが無い週は基準が作れないため検出しない", () => {
    const weeks = [week(0, 60, 3), week(1, 60, 3), week(2, 60, 3), week(3, 60, 3), week(4, 60, null)];
    const days = daysOf(4, [3, 0, 3, 0, 1, 0, 0], [3, 2, 3, 2, 3, null, null]);

    expect(buildHighlights(weeks, days).patterns).toEqual([]);
  });

  test("メッセージは固定のテンプレート文で、評価的な言葉を含まない", () => {
    const weeks = [...baseWeeks];
    const days = daysOf(3, [3, 0, 3, 0, 1, 0, 0], [3, 2, 3, 2, 3, null, null]);

    const [insight] = buildHighlights(weeks, days).patterns;

    expect(insight.message).toBe("タスクを詰め込んだ翌日は、少しペースが落ちる傾向があるようです。");
    expect(insight.weekStart).toBe(weekStart(3));
  });
});

test("閾値は定数として調整できる形になっている", () => {
  expect(HIGHLIGHT_RULES.achievementWeight + HIGHLIGHT_RULES.scoreWeight).toBe(1);
  expect(HIGHLIGHT_RULES.minWeeks).toBe(4);
});
