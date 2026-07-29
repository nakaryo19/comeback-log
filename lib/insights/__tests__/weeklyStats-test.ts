import { buildWeeklyStats } from "../weeklyStats";
import type { EmotionEntry } from "../../supabase/emotionLogs";
import type { Task, TaskStatus, UUID } from "../../../types/database";

const WEEK_A = "2026-07-06"; // 月
const WEEK_B = "2026-07-13"; // 月
const TODAY = "2026-07-15"; // WEEK_B の水曜

function makeTask(id: string, date: string, status: TaskStatus = "done"): Task {
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

function entries(pairs: [UUID, EmotionEntry][]): Map<UUID, EmotionEntry> {
  return new Map(pairs);
}

describe("buildWeeklyStats", () => {
  test("週ごとに達成率と平均スコアを集計する", () => {
    const tasks = [
      makeTask("t1", "2026-07-06", "done"),
      makeTask("t2", "2026-07-08", "todo"),
      makeTask("t3", "2026-07-13", "done"),
    ];
    const weeks = buildWeeklyStats(
      [WEEK_A, WEEK_B],
      tasks,
      entries([
        ["t1", { score: 4, tag: "達成感" }],
        ["t3", { score: 2, tag: null }],
      ]),
      TODAY,
    );

    expect(weeks[0]).toMatchObject({
      start: WEEK_A,
      end: "2026-07-12",
      totalCount: 2,
      completedCount: 1,
      achievementRate: 50,
      averageScore: 4,
    });
    expect(weeks[1]).toMatchObject({ achievementRate: 100, averageScore: 2 });
  });

  test("タスクが1件も無い週は達成率・平均スコアとも null", () => {
    const weeks = buildWeeklyStats([WEEK_A], [], new Map(), TODAY);
    expect(weeks[0].achievementRate).toBeNull();
    expect(weeks[0].averageScore).toBeNull();
    expect(weeks[0].totalCount).toBe(0);
  });

  test("感情ログが無い週の平均スコアは 0 ではなく null", () => {
    const weeks = buildWeeklyStats([WEEK_A], [makeTask("t1", "2026-07-06")], new Map(), TODAY);
    expect(weeks[0].achievementRate).toBe(100);
    expect(weeks[0].averageScore).toBeNull();
  });

  test("まだ来ていない日の予定は達成率の分母に入れない", () => {
    const tasks = [
      makeTask("t1", "2026-07-13", "done"),
      makeTask("t2", "2026-07-17", "todo"), // TODAY より後の予定
    ];
    const weeks = buildWeeklyStats([WEEK_B], tasks, new Map(), TODAY);
    expect(weeks[0].totalCount).toBe(1);
    expect(weeks[0].achievementRate).toBe(100);
  });

  test("未来日のタスクに付いた感情ログは平均に含める（記録は落とさない）", () => {
    const tasks = [makeTask("t2", "2026-07-17", "todo")];
    const weeks = buildWeeklyStats(
      [WEEK_B],
      tasks,
      entries([["t2", { score: 5, tag: null }]]),
      TODAY,
    );
    expect(weeks[0].averageScore).toBe(5);
  });

  test("タグを週ごとに数え、未選択・未知のタグは数えない", () => {
    const tasks = [
      makeTask("t1", "2026-07-06"),
      makeTask("t2", "2026-07-07"),
      makeTask("t3", "2026-07-08"),
      makeTask("t4", "2026-07-09"),
    ];
    const weeks = buildWeeklyStats(
      [WEEK_A],
      tasks,
      entries([
        ["t1", { score: 3, tag: "集中" }],
        ["t2", { score: 3, tag: "集中" }],
        ["t3", { score: 3, tag: null }],
        ["t4", { score: 3, tag: "削除済みのタグ" }],
      ]),
      TODAY,
    );
    expect(weeks[0].tagCounts.集中).toBe(2);
    expect(weeks[0].tagCounts.不安).toBe(0);
  });

  test("平均スコアは小数第1位に丸める", () => {
    const tasks = [makeTask("t1", "2026-07-06"), makeTask("t2", "2026-07-07")];
    const weeks = buildWeeklyStats(
      [WEEK_A],
      tasks,
      entries([
        ["t1", { score: 4, tag: null }],
        ["t2", { score: 5, tag: null }],
      ]),
      TODAY,
    );
    expect(weeks[0].averageScore).toBe(4.5);
  });
});
