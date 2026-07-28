import { render, screen } from "@testing-library/react-native";
import { DailyTrendChart, buildLineSegments } from "../DailyTrendChart";
import { fetchTasksForDateRange } from "../../../lib/supabase/tasks";
import { fetchEmotionScoresByTaskId } from "../../../lib/supabase/emotionLogs";
import type { DailyStat } from "../../../lib/insights/dailyStats";
import type { EmotionScore, Task, TaskStatus, UUID } from "../../../types/database";

// 実行日に依存させない。日付の「日」が 1〜5 だと、縦軸の目盛り（1〜5）と
// 文字列として区別できなくなり、月初に実行したときだけ落ちるテストになる。
const days = [
  "2026-07-22",
  "2026-07-23",
  "2026-07-24",
  "2026-07-25",
  "2026-07-26",
  "2026-07-27",
  "2026-07-28",
];

jest.mock("../../../lib/date", () => ({
  ...jest.requireActual("../../../lib/date"),
  recentDateStrings: jest.fn(() => days),
}));
jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForDateRange: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  fetchEmotionScoresByTaskId: jest.fn(),
}));

const mockFetchTasks = fetchTasksForDateRange as jest.MockedFunction<typeof fetchTasksForDateRange>;
const mockFetchScores = fetchEmotionScoresByTaskId as jest.MockedFunction<
  typeof fetchEmotionScoresByTaskId
>;

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

async function setup(tasks: Task[], scores: [UUID, EmotionScore][]) {
  mockFetchTasks.mockResolvedValue(tasks);
  mockFetchScores.mockResolvedValue(new Map(scores));
  return await render(<DailyTrendChart />);
}

function stat(date: string, completedCount: number, averageScore: number | null): DailyStat {
  return { date, completedCount, averageScore };
}

describe("<DailyTrendChart />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("直近7日（今日を含む）を範囲としてタスクを取得する", async () => {
    await setup([], []);
    await screen.findByText("直近7日の記録");

    expect(mockFetchTasks).toHaveBeenCalledWith(days[0], days[6]);
    expect(days).toHaveLength(7);
  });

  test("記録の無い日も日付の列として残り、完了数 0 を表示する", async () => {
    // 散布図と違い、記録が無い日も横軸から消えないことが要点
    await setup([], []);

    await screen.findByText("直近7日の記録");
    for (const date of days) {
      // 「日」付き（例: "22日"）。数字だけだと完了件数の数字と見分けがつかない
      await screen.findByText(`${Number(date.slice(8, 10))}日`);
    }
    expect(screen.getAllByText("0")).toHaveLength(7);
  });

  test("日付の下に曜日を表示する", async () => {
    // days は 7/22(水) 〜 7/28(火)
    await setup([], []);

    await screen.findByText("22日");
    for (const weekday of ["水", "木", "金", "土", "日", "月", "火"]) {
      await screen.findByText(weekday);
    }
  });

  test("日ごとの完了タスク数を数字で表示する", async () => {
    // 棒は縦軸（感情スコア）の目盛りに対応しないため、件数は必ず数字で読ませる。
    // 件数は 6 にしてある（1〜5 だと縦軸の目盛りと文字列が衝突する）
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask(`t${i}`, days[6]));
    await setup(tasks, []);

    await screen.findByText("6");
    expect(screen.getAllByText("0")).toHaveLength(6);
  });

  test("感情ログのある日は点として描かれ、日付・完了数・スコアを読み上げられる", async () => {
    await setup(
      [makeTask("t1", days[5]), makeTask("t2", days[5]), makeTask("t3", days[6])],
      [
        ["t1", 4],
        ["t2", 2],
        ["t3", 5],
      ],
    );

    // days[5] は完了2件・平均3、days[6] は完了1件・平均5
    await screen.findByLabelText(/完了 2 件、平均スコア 3$/);
    await screen.findByLabelText(/完了 1 件、平均スコア 5$/);
  });

  test("感情ログの無い日には点を打たない", async () => {
    await setup([makeTask("t1", days[4]), makeTask("t2", days[5])], [["t1", 3]]);

    expect(await screen.findAllByLabelText(/平均スコア/)).toHaveLength(1);
  });

  test("凡例で棒と折れ線がそれぞれ何を指すか示す", async () => {
    await setup([], []);

    await screen.findByText("完了タスク数");
    await screen.findByText("感情スコア（5点満点）");
  });
});

describe("buildLineSegments", () => {
  test("隣り合う記録同士を結ぶ", () => {
    const segments = buildLineSegments(
      [stat("2026-07-20", 1, 3), stat("2026-07-21", 2, 4)],
      100,
    );

    expect(segments).toHaveLength(1);
    expect(segments[0].key).toBe("2026-07-20-2026-07-21");
  });

  test("記録の無い日を飛び越えて線を引かない", () => {
    // 書いていない日の気持ちを勝手に補間した図にしないため、間が空いたら線を切る
    const segments = buildLineSegments(
      [stat("2026-07-20", 1, 3), stat("2026-07-21", 0, null), stat("2026-07-22", 2, 4)],
      100,
    );

    expect(segments).toHaveLength(0);
  });

  test("記録が1日しか無ければ線分は生まれない", () => {
    expect(buildLineSegments([stat("2026-07-20", 1, 3)], 100)).toHaveLength(0);
  });

  test("スコアが横ばいなら水平な線分になる", () => {
    const [segment] = buildLineSegments(
      [stat("2026-07-20", 1, 3), stat("2026-07-21", 2, 3)],
      100,
    );

    expect(segment.angle).toBeCloseTo(0);
    expect(segment.length).toBe(100); // 列の中心間＝列幅ぶん
  });

  test("スコアが上がる区間は上向き、下がる区間は下向きに傾く", () => {
    const [rising] = buildLineSegments(
      [stat("2026-07-20", 1, 2), stat("2026-07-21", 1, 4)],
      100,
    );
    const [falling] = buildLineSegments(
      [stat("2026-07-20", 1, 4), stat("2026-07-21", 1, 2)],
      100,
    );

    // 画面上で右上がりの線は反時計回りの回転にあたるため、角度は負になる。
    // 上がる区間と下がる区間が符号だけ違う（左右対称になる）ことを確かめる
    expect(rising.angle).toBeLessThan(0);
    expect(falling.angle).toBeGreaterThan(0);
    expect(rising.angle).toBeCloseTo(-falling.angle);
  });
});
