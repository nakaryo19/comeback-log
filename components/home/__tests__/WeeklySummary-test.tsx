import { render, screen } from "@testing-library/react-native";
import { WeeklySummary } from "../WeeklySummary";
import { shiftDateString, todayDateString } from "../../../lib/date";
import { fetchTasksForDateRange } from "../../../lib/supabase/tasks";
import { fetchEmotionScoresForTasks } from "../../../lib/supabase/emotionLogs";
import { fetchActiveDates } from "../../../lib/supabase/activity";
import type { EmotionScore, ISODateString, Task, TaskStatus } from "../../../types/database";

jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForDateRange: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  fetchEmotionScoresForTasks: jest.fn(),
}));
jest.mock("../../../lib/supabase/activity", () => ({
  fetchActiveDates: jest.fn(),
}));

const mockFetchTasks = fetchTasksForDateRange as jest.MockedFunction<
  typeof fetchTasksForDateRange
>;
const mockFetchScores = fetchEmotionScoresForTasks as jest.MockedFunction<
  typeof fetchEmotionScoresForTasks
>;
const mockFetchActiveDates = fetchActiveDates as jest.MockedFunction<typeof fetchActiveDates>;

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

async function setup(tasks: Task[], scores: EmotionScore[], activeDates: ISODateString[] = []) {
  mockFetchTasks.mockResolvedValue(tasks);
  mockFetchScores.mockResolvedValue(scores);
  mockFetchActiveDates.mockResolvedValue(new Set(activeDates));
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
    await screen.findByText("4 / 5"); // (4+5+3)/3。5点満点であることが分かるよう分母を添える
  });

  test("平均スコアは小数第1位まで丸める", async () => {
    await setup([makeTask("t1", "done")], [3, 4]);
    await screen.findByText("3.5 / 5");
  });

  test("タスクが無い週は達成率を「－」と表示する", async () => {
    await setup([], []);
    // 達成率・平均スコア・継続日数のすべてが「－」
    expect(await screen.findAllByText("－")).toHaveLength(3);
  });

  test("感情ログが無ければ平均スコアを「－」と表示する", async () => {
    // 未着手のタスクだけなので、平均スコアと継続日数の2つが「－」になる。
    // 達成率は 0% として数値が出る（分母のタスクは存在するため）
    await setup([makeTask("t1", "todo")], []);
    await screen.findByText("0%");
    expect(await screen.findAllByText("－")).toHaveLength(2);
  });
});

describe("<WeeklySummary /> 継続日数", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("記録が続いている日数を表示する", async () => {
    const today = todayDateString();
    await setup([], [], [today, shiftDateString(today, -1), shiftDateString(today, -2)]);
    await screen.findByText("3日");
  });

  test("今日がまだ未記録でも、昨日までの連続を表示する", async () => {
    const today = todayDateString();
    await setup([], [], [shiftDateString(today, -1), shiftDateString(today, -2)]);
    await screen.findByText("2日");
  });

  test("途切れているときは 0 ではなく「－」を表示する", async () => {
    const today = todayDateString();
    // 一昨日までは続いていたが、昨日・今日は記録が無い
    await setup([], [], [shiftDateString(today, -2), shiftDateString(today, -3)]);
    expect(screen.queryByText("0")).toBeNull();
    expect(await screen.findAllByText("－")).toHaveLength(3);
  });
});

describe("<WeeklySummary /> 先の予定の扱い", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("まだ来ていない日の予定は達成率の分母に入れない", async () => {
    const today = todayDateString();
    const future = shiftDateString(today, 3);
    await setup(
      [
        { ...makeTask("t1", "done"), date: today },
        { ...makeTask("t2", "todo"), date: future },
        { ...makeTask("t3", "todo"), date: future },
      ],
      [],
    );

    // 未来の2件を除いた 1/1 = 100%（分母に入れていれば 33%）
    await screen.findByText("100%");
  });

  test("過去・当日の予定は従来通り分母に入れる", async () => {
    const today = todayDateString();
    await setup(
      [
        { ...makeTask("t1", "done"), date: shiftDateString(today, -1) },
        { ...makeTask("t2", "todo"), date: today },
      ],
      [],
    );

    await screen.findByText("50%");
  });
});
