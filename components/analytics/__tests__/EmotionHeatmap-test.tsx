import { fireEvent, render, screen } from "@testing-library/react-native";
import { EmotionHeatmap } from "../EmotionHeatmap";
import { fetchTasksForDateRange } from "../../../lib/supabase/tasks";
import { fetchEmotionScoresByTaskId } from "../../../lib/supabase/emotionLogs";
import type { Task } from "../../../types/database";

// 表示月を実行日に依存させない（月の日数も曜日の並びも変わってしまうため）
jest.mock("../../../lib/date", () => ({
  ...jest.requireActual("../../../lib/date"),
  currentMonthString: jest.fn(() => "2026-07"),
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

function makeTask(id: string, date: string): Task {
  return {
    id,
    sub_goal_id: "sg-1",
    title: "タスク",
    status: "done",
    date,
    created_at: `${date}T00:00:00Z`,
    updated_at: `${date}T00:00:00Z`,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchTasks.mockResolvedValue([]);
  mockFetchScores.mockResolvedValue(new Map());
});

describe("EmotionHeatmap", () => {
  test("当月のラベルと、月末までの日付マスを表示する", async () => {
    await render(<EmotionHeatmap />);

    expect(await screen.findByText("2026年7月")).toBeTruthy();
    // 7月は31日まで。1日ぶんのマスと31日ぶんのマスが揃っていること
    expect(screen.getByLabelText("1日：感情の記録なし")).toBeTruthy();
    expect(screen.getByLabelText("31日：感情の記録なし")).toBeTruthy();
  });

  test("感情ログのある日は平均スコアを読み上げラベルに載せる", async () => {
    mockFetchTasks.mockResolvedValue([makeTask("t1", "2026-07-10")]);
    mockFetchScores.mockResolvedValue(new Map([["t1", 4]]));

    await render(<EmotionHeatmap />);

    expect(await screen.findByLabelText("10日：平均スコア 4")).toBeTruthy();
  });

  test("前の月へ移動できる", async () => {
    await render(<EmotionHeatmap />);
    await screen.findByText("2026年7月");

    await fireEvent.press(screen.getByLabelText("前の月"));

    expect(await screen.findByText("2026年6月")).toBeTruthy();
    // 6月は30日まで。前月の日数で描き直されていること
    expect(screen.queryByLabelText("31日：感情の記録なし")).toBeNull();
  });

  test("未来の月へは移動できない", async () => {
    await render(<EmotionHeatmap />);
    await screen.findByText("2026年7月");

    await fireEvent.press(screen.getByLabelText("次の月"));

    expect(screen.getByText("2026年7月")).toBeTruthy();
  });
});
