import { fireEvent, render, screen } from "@testing-library/react-native";
import { AnalyticsScreen } from "../AnalyticsScreen";
import { fetchTasksForDateRange } from "../../../lib/supabase/tasks";
import { fetchEmotionEntriesByTaskId } from "../../../lib/supabase/emotionLogs";
import type { Task, TaskStatus } from "../../../types/database";

// 実行日に依存させない。週の区切りも月の日数も、実行した日によって変わってしまうため固定する。
const WEEK_STARTS = ["2026-07-06", "2026-07-13"];

jest.mock("../../../lib/date", () => ({
  ...jest.requireActual("../../../lib/date"),
  recentWeekStarts: jest.fn(() => WEEK_STARTS),
  currentMonthString: jest.fn(() => "2026-07"),
  todayDateString: jest.fn(() => "2026-07-15"),
}));
jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForDateRange: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  fetchEmotionEntriesByTaskId: jest.fn(),
  fetchEmotionScoresByTaskId: jest.fn(() => Promise.resolve(new Map())),
}));

const mockFetchTasks = fetchTasksForDateRange as jest.MockedFunction<typeof fetchTasksForDateRange>;
const mockFetchEntries = fetchEmotionEntriesByTaskId as jest.MockedFunction<
  typeof fetchEmotionEntriesByTaskId
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

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchTasks.mockResolvedValue([]);
  mockFetchEntries.mockResolvedValue(new Map());
});

describe("AnalyticsScreen", () => {
  test("週ごとの達成率と平均スコアを一覧表示する", async () => {
    mockFetchTasks.mockResolvedValue([
      makeTask("t1", "2026-07-06", "done"),
      makeTask("t2", "2026-07-07", "todo"),
    ]);
    mockFetchEntries.mockResolvedValue(
      new Map([
        ["t1", { score: 4, tag: "達成感" }],
        ["t2", { score: 5, tag: null }],
      ]),
    );

    await render(<AnalyticsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("7/6 〜 7/12")).toBeTruthy();
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByText("1/2 件")).toBeTruthy();
    // 整数だとヒートマップの日付マス（1〜31）と文字列として区別が付かないため、
    // 平均が小数になる組み合わせで検証する
    expect(screen.getByText("4.5")).toBeTruthy();
  });

  test("記録の無い週は数値の代わりにハイフンを出す（0 とは区別する）", async () => {
    await render(<AnalyticsScreen onBack={jest.fn()} />);

    // 2週分すべてが記録なし。達成率・平均スコアで週あたり2つ
    expect(await screen.findAllByText("－")).toHaveLength(WEEK_STARTS.length * 2);
  });

  test("タグの記録が1件も無ければ、空の棒グラフではなく説明文を出す", async () => {
    mockFetchTasks.mockResolvedValue([makeTask("t1", "2026-07-06")]);
    mockFetchEntries.mockResolvedValue(new Map([["t1", { score: 3, tag: null }]]));

    await render(<AnalyticsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("タグを付けた記録がまだありません")).toBeTruthy();
  });

  test("タグがあれば凡例と週ごとの合計件数を表示する", async () => {
    mockFetchTasks.mockResolvedValue([
      makeTask("t1", "2026-07-06"),
      makeTask("t2", "2026-07-07"),
    ]);
    mockFetchEntries.mockResolvedValue(
      new Map([
        ["t1", { score: 3, tag: "集中" }],
        ["t2", { score: 5, tag: "達成感" }],
      ]),
    );

    await render(<AnalyticsScreen onBack={jest.fn()} />);

    expect(await screen.findByText("感情タグの推移")).toBeTruthy();
    expect(screen.getByText("集中")).toBeTruthy();
    expect(screen.getByText("疲労")).toBeTruthy(); // 件数0のタグも凡例には出す
  });

  test("ホームへ戻れる", async () => {
    const onBack = jest.fn();
    await render(<AnalyticsScreen onBack={onBack} />);

    await fireEvent.press(await screen.findByText("ホームへ"));
    expect(onBack).toHaveBeenCalled();
  });
});
