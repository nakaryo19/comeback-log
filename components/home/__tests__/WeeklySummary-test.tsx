import { render, screen } from "@testing-library/react-native";
import { WeeklySummary } from "../WeeklySummary";
import { fetchTasksForDateRange } from "../../../lib/supabase/tasks";
import { fetchEmotionScoresForTasks } from "../../../lib/supabase/emotionLogs";
import type { EmotionScore, Task, TaskStatus } from "../../../types/database";

jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForDateRange: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  fetchEmotionScoresForTasks: jest.fn(),
}));

const mockFetchTasks = fetchTasksForDateRange as jest.MockedFunction<
  typeof fetchTasksForDateRange
>;
const mockFetchScores = fetchEmotionScoresForTasks as jest.MockedFunction<
  typeof fetchEmotionScoresForTasks
>;

function makeTask(id: string, status: TaskStatus): Task {
  return {
    id,
    sub_goal_id: "sg-1",
    title: "タスク",
    status,
    date: "2026-07-15",
    created_at: "2026-07-15T00:00:00Z",
    updated_at: "2026-07-15T00:00:00Z",
  };
}

async function setup(tasks: Task[], scores: EmotionScore[]) {
  mockFetchTasks.mockResolvedValue(tasks);
  mockFetchScores.mockResolvedValue(scores);
  return await render(<WeeklySummary />);
}

describe("<WeeklySummary />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("今週の達成率（done÷全タスク）と平均感情スコアを表示する", async () => {
    await setup(
      [makeTask("t1", "done"), makeTask("t2", "done"), makeTask("t3", "todo"), makeTask("t4", "partial")],
      [4, 5, 3],
    );

    await screen.findByText("50%"); // done 2/4
    await screen.findByText("4"); // (4+5+3)/3
  });

  test("平均スコアは小数第1位まで丸める", async () => {
    await setup([makeTask("t1", "done")], [3, 4]);
    await screen.findByText("3.5");
  });

  test("タスクが無い週は達成率を「－」と表示する", async () => {
    await setup([], []);
    // 達成率・平均スコアの両方が「－」
    expect(await screen.findAllByText("－")).toHaveLength(2);
  });

  test("感情ログが無ければ平均スコアのみ「－」と表示する", async () => {
    await setup([makeTask("t1", "todo")], []);
    await screen.findByText("0%");
    await screen.findByText("－");
  });
});
