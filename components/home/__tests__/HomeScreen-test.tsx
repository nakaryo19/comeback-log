import { fireEvent, render, screen } from "@testing-library/react-native";
import { HomeScreen } from "../HomeScreen";
import { formatShortDate, shiftDateString, todayDateString } from "../../../lib/date";
import { createTask, fetchTasksForDate, fetchTasksForDateRange } from "../../../lib/supabase/tasks";
import { fetchEmotionScoresForTasks, fetchLoggedTaskIds } from "../../../lib/supabase/emotionLogs";
import type { GoalWithSubGoals } from "../../../lib/supabase/goals";
import type { Task, TaskStatus } from "../../../types/database";

jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForDate: jest.fn(),
  fetchTasksForDateRange: jest.fn(),
  createTask: jest.fn(),
  updateTaskStatus: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  fetchLoggedTaskIds: jest.fn(),
  fetchEmotionScoresForTasks: jest.fn(),
  createEmotionLog: jest.fn(),
}));
jest.mock("../../../lib/supabase/goals", () => ({
  findDefaultSubGoalId: jest.fn(() => "sg-1"),
}));

const mockFetchTasksForDate = fetchTasksForDate as jest.MockedFunction<typeof fetchTasksForDate>;
const mockFetchTasksForDateRange = fetchTasksForDateRange as jest.MockedFunction<
  typeof fetchTasksForDateRange
>;
const mockFetchLoggedTaskIds = fetchLoggedTaskIds as jest.MockedFunction<typeof fetchLoggedTaskIds>;
const mockFetchEmotionScores = fetchEmotionScoresForTasks as jest.MockedFunction<
  typeof fetchEmotionScoresForTasks
>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;

const TODAY = todayDateString();
const YESTERDAY = shiftDateString(TODAY, -1);

function makeTask(id: string, title: string, date: string, status: TaskStatus = "todo"): Task {
  return {
    id,
    sub_goal_id: "sg-1",
    title,
    status,
    date,
    created_at: `${date}T00:00:00Z`,
    updated_at: `${date}T00:00:00Z`,
  };
}

const goals: GoalWithSubGoals[] = [
  {
    id: "g-1",
    user_id: "u-1",
    title: "公務員試験に合格する",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    sub_goals: [],
  },
];

/** 日付ごとのタスクを返すようモックを仕込む */
function stubTasksByDate(tasksByDate: Record<string, Task[]>) {
  mockFetchTasksForDate.mockImplementation(async (date) => tasksByDate[date] ?? []);
}

async function renderHome() {
  return await render(<HomeScreen goals={goals} onOpenGoalManagement={jest.fn()} />);
}

describe("<HomeScreen /> 日付切り替え", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchLoggedTaskIds.mockResolvedValue(new Set());
    mockFetchTasksForDateRange.mockResolvedValue([]);
    mockFetchEmotionScores.mockResolvedValue([]);
    stubTasksByDate({});
  });

  test("初期表示では今日のタスクを取得する", async () => {
    stubTasksByDate({ [TODAY]: [makeTask("t1", "英単語100個", TODAY)] });
    await renderHome();

    expect(await screen.findByText("英単語100個")).toBeTruthy();
    expect(mockFetchTasksForDate).toHaveBeenCalledWith(TODAY);
    expect(screen.getByText("今日のタスク")).toBeTruthy();
  });

  test("「前日」を押すと前日のタスクを取得して表示する", async () => {
    stubTasksByDate({
      [TODAY]: [makeTask("t1", "英単語100個", TODAY)],
      [YESTERDAY]: [makeTask("t0", "過去問1年分", YESTERDAY)],
    });
    await renderHome();
    await screen.findByText("英単語100個");

    await fireEvent.press(screen.getByLabelText("前日"));

    expect(await screen.findByText("過去問1年分")).toBeTruthy();
    expect(mockFetchTasksForDate).toHaveBeenCalledWith(YESTERDAY);
    expect(screen.queryByText("英単語100個")).toBeNull();
    expect(screen.getByText(`${formatShortDate(YESTERDAY)}のタスク`)).toBeTruthy();
  });

  test("「今日へ戻る」で今日の表示に復帰する", async () => {
    stubTasksByDate({ [TODAY]: [makeTask("t1", "英単語100個", TODAY)] });
    await renderHome();
    await screen.findByText("英単語100個");

    await fireEvent.press(screen.getByLabelText("前日"));
    await screen.findByText("今日へ戻る");
    await fireEvent.press(screen.getByText("今日へ戻る"));

    expect(await screen.findByText("英単語100個")).toBeTruthy();
    expect(screen.getByText("今日のタスク")).toBeTruthy();
  });

  test("過去日で完了にすると、その場で感情ログ入力が現れる", async () => {
    stubTasksByDate({ [YESTERDAY]: [makeTask("t0", "過去問1年分", YESTERDAY)] });
    await renderHome();

    await fireEvent.press(screen.getByLabelText("前日"));
    await screen.findByText("過去問1年分");
    await fireEvent.press(screen.getByText("完了"));

    expect(await screen.findByText("お疲れさまでした。今の気分は？")).toBeTruthy();
  });

  test("過去日でタスクを追加すると、その日付のタスクとして作成する", async () => {
    stubTasksByDate({ [YESTERDAY]: [] });
    mockCreateTask.mockResolvedValue(makeTask("t9", "復習", YESTERDAY));
    await renderHome();

    await fireEvent.press(screen.getByLabelText("前日"));
    const input = await screen.findByPlaceholderText(`${formatShortDate(YESTERDAY)}のタスクを追加`);
    await fireEvent.changeText(input, "復習");
    await fireEvent.press(screen.getByText("追加"));

    expect(mockCreateTask).toHaveBeenCalledWith({
      subGoalId: "sg-1",
      title: "復習",
      date: YESTERDAY,
    });
  });
});
