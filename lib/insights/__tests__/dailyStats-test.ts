import { buildDailyStats } from "../dailyStats";
import type { EmotionScore, Task, TaskStatus, UUID } from "../../../types/database";

function makeTask(id: string, date: string, status: TaskStatus): Task {
  return {
    id,
    sub_goal_id: "sg-1",
    title: "タスク",
    status,
    date,
    created_at: `${date}T00:00:00Z`,
    updated_at: `${date}T00:00:00Z`,
  };
}

function scores(entries: [UUID, EmotionScore][]): Map<UUID, EmotionScore> {
  return new Map(entries);
}

describe("buildDailyStats", () => {
  test("日ごとに完了タスク数と平均感情スコアを集計する", () => {
    const stats = buildDailyStats(
      ["2026-07-20", "2026-07-21"],
      [
        makeTask("t1", "2026-07-20", "done"),
        makeTask("t2", "2026-07-20", "done"),
        makeTask("t3", "2026-07-21", "done"),
      ],
      scores([
        ["t1", 4],
        ["t2", 2],
        ["t3", 5],
      ]),
    );

    expect(stats).toEqual([
      { date: "2026-07-20", completedCount: 2, averageScore: 3 },
      { date: "2026-07-21", completedCount: 1, averageScore: 5 },
    ]);
  });

  test("部分達成・未完了は完了数に数えない", () => {
    const stats = buildDailyStats(
      ["2026-07-20"],
      [
        makeTask("t1", "2026-07-20", "done"),
        makeTask("t2", "2026-07-20", "partial"),
        makeTask("t3", "2026-07-20", "todo"),
      ],
      scores([]),
    );

    expect(stats[0].completedCount).toBe(1);
  });

  test("感情ログが無い日の平均スコアは 0 ではなく null になる", () => {
    // 「記録しなかった日」と「気分が最低だった日」は別物なので、点を打ってはいけない
    const stats = buildDailyStats(
      ["2026-07-20"],
      [makeTask("t1", "2026-07-20", "done")],
      scores([]),
    );

    expect(stats[0]).toEqual({ date: "2026-07-20", completedCount: 1, averageScore: null });
  });

  test("タスクが1件も無い日も、完了0件として日付の並びに残る", () => {
    const stats = buildDailyStats(["2026-07-20", "2026-07-21"], [], scores([]));

    expect(stats.map((s) => s.date)).toEqual(["2026-07-20", "2026-07-21"]);
    expect(stats.every((s) => s.completedCount === 0)).toBe(true);
  });

  test("完了を取り消したタスクの感情ログも平均に含める", () => {
    // ステータスを戻してもログは残る。記録した気持ちを集計から落とさない
    const stats = buildDailyStats(
      ["2026-07-20"],
      [makeTask("t1", "2026-07-20", "todo")],
      scores([["t1", 3]]),
    );

    expect(stats[0]).toEqual({ date: "2026-07-20", completedCount: 0, averageScore: 3 });
  });

  test("平均スコアは小数第1位まで丸める", () => {
    const stats = buildDailyStats(
      ["2026-07-20"],
      [
        makeTask("t1", "2026-07-20", "done"),
        makeTask("t2", "2026-07-20", "done"),
        makeTask("t3", "2026-07-20", "done"),
      ],
      scores([
        ["t1", 1],
        ["t2", 2],
        ["t3", 2],
      ]),
    );

    expect(stats[0].averageScore).toBe(1.7);
  });

  test("指定した日付の順序をそのまま保つ", () => {
    const dates = ["2026-07-18", "2026-07-19", "2026-07-20"];
    expect(buildDailyStats(dates, [], scores([])).map((s) => s.date)).toEqual(dates);
  });
});
