import { fireEvent, render, screen } from "@testing-library/react-native";
import { GoalManagementScreen } from "../GoalManagementScreen";
import {
  createGoal,
  deleteGoal,
  deleteSubGoal,
  renameGoal,
  type GoalWithSubGoals,
} from "../../../lib/supabase/goals";
import {
  fetchTaskCountsBySubGoal,
  fetchTaskIdsForSubGoals,
  fetchTasksForSubGoal,
  fetchTasksForSubGoals,
} from "../../../lib/supabase/tasks";
import { countEmotionLogsForTasks } from "../../../lib/supabase/emotionLogs";
import { useAuth } from "../../../lib/supabase/auth-context";
import type { SubGoal, Task, TaskStatus } from "../../../types/database";

jest.mock("../../../lib/supabase/goals", () => ({
  createGoal: jest.fn(),
  renameGoal: jest.fn(),
  createSubGoal: jest.fn(),
  renameSubGoal: jest.fn(),
  deleteGoal: jest.fn(),
  deleteSubGoal: jest.fn(),
}));
jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForSubGoals: jest.fn(),
  fetchTaskIdsForSubGoals: jest.fn(),
  fetchTaskCountsBySubGoal: jest.fn(),
  fetchTasksForSubGoal: jest.fn(),
  reassignTask: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  countEmotionLogsForTasks: jest.fn(),
}));
jest.mock("../../../lib/supabase/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockCreateGoal = createGoal as jest.MockedFunction<typeof createGoal>;
const mockRenameGoal = renameGoal as jest.MockedFunction<typeof renameGoal>;
const mockFetchTasks = fetchTasksForSubGoals as jest.MockedFunction<typeof fetchTasksForSubGoals>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockDeleteGoal = deleteGoal as jest.MockedFunction<typeof deleteGoal>;
const mockDeleteSubGoal = deleteSubGoal as jest.MockedFunction<typeof deleteSubGoal>;
const mockFetchTaskIds = fetchTaskIdsForSubGoals as jest.MockedFunction<
  typeof fetchTaskIdsForSubGoals
>;
const mockCountEmotionLogs = countEmotionLogsForTasks as jest.MockedFunction<
  typeof countEmotionLogsForTasks
>;
const mockTaskCounts = fetchTaskCountsBySubGoal as jest.MockedFunction<
  typeof fetchTaskCountsBySubGoal
>;
const mockFetchTasksForSubGoal = fetchTasksForSubGoal as jest.MockedFunction<
  typeof fetchTasksForSubGoal
>;

function makeSubGoal(id: string, goalId: string, title: string): SubGoal {
  return {
    id,
    goal_id: goalId,
    title,
    is_provisional: true,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

function makeGoal(id: string, title: string): GoalWithSubGoals {
  return {
    id,
    user_id: "u-1",
    title,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    sub_goals: [makeSubGoal(`sg-${id}`, id, "ステップ1")],
  };
}

async function renderScreen(goals: GoalWithSubGoals[]) {
  const onGoalsChanged = jest.fn();
  await render(
    <GoalManagementScreen goals={goals} onBack={jest.fn()} onGoalsChanged={onGoalsChanged} />,
  );
  return { onGoalsChanged };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchTasks.mockResolvedValue([]);
  mockUseAuth.mockReturnValue({ user: { id: "u-1" } } as ReturnType<typeof useAuth>);
  mockFetchTaskIds.mockResolvedValue([]);
  mockTaskCounts.mockResolvedValue({});
  mockFetchTasksForSubGoal.mockResolvedValue([]);
  mockCountEmotionLogs.mockResolvedValue(0);
  mockDeleteGoal.mockResolvedValue(undefined);
  mockDeleteSubGoal.mockResolvedValue(undefined);
});

describe("<GoalManagementScreen /> 大目標の管理", () => {
  test("大目標を追加できる", async () => {
    const { onGoalsChanged } = await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.changeText(
      screen.getByPlaceholderText("例：AWS認定資格を取得する"),
      "個人開発アプリをリリースする",
    );
    await fireEvent.press(screen.getByLabelText("大目標を追加する"));

    expect(mockCreateGoal).toHaveBeenCalledWith("u-1", "個人開発アプリをリリースする");
    expect(onGoalsChanged).toHaveBeenCalled();
  });

  test("空文字では大目標を追加しない", async () => {
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.changeText(screen.getByPlaceholderText("例：AWS認定資格を取得する"), "   ");
    await fireEvent.press(screen.getByLabelText("大目標を追加する"));

    expect(mockCreateGoal).not.toHaveBeenCalled();
  });

  test("複数の大目標をそれぞれ表示する", async () => {
    await renderScreen([
      makeGoal("g-1", "公務員試験に合格する"),
      makeGoal("g-2", "AWS認定資格を取得する"),
    ]);

    expect(screen.getByDisplayValue("公務員試験に合格する")).toBeTruthy();
    expect(screen.getByDisplayValue("AWS認定資格を取得する")).toBeTruthy();
  });

  test("大目標の名前を変更できる", async () => {
    const { onGoalsChanged } = await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    const input = screen.getByDisplayValue("公務員試験に合格する");
    await fireEvent.changeText(input, "国家公務員試験に合格する");
    await fireEvent(input, "blur");

    expect(mockRenameGoal).toHaveBeenCalledWith("g-1", "国家公務員試験に合格する");
    expect(onGoalsChanged).toHaveBeenCalled();
  });

  test("名前が変わっていなければ更新しない", async () => {
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent(screen.getByDisplayValue("公務員試験に合格する"), "blur");

    expect(mockRenameGoal).not.toHaveBeenCalled();
  });
});

describe("<GoalManagementScreen /> 削除", () => {
  function goalWithSubGoals(...titles: string[]): GoalWithSubGoals {
    return {
      ...makeGoal("g-1", "公務員試験に合格する"),
      sub_goals: titles.map((t, i) => makeSubGoal(`sg-${i + 1}`, "g-1", t)),
    };
  }

  test("大目標の削除は確認を挟み、消える件数を表示する", async () => {
    mockFetchTaskIds.mockResolvedValue(["t1", "t2", "t3"]);
    mockCountEmotionLogs.mockResolvedValue(2);
    const { onGoalsChanged } = await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.press(screen.getByLabelText("大目標「公務員試験に合格する」を削除"));

    expect(await screen.findByText(/タスク 3 件/)).toBeTruthy();
    expect(screen.getByText(/感情ログ 2 件/)).toBeTruthy();
    expect(mockDeleteGoal).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("削除する"));
    expect(mockDeleteGoal).toHaveBeenCalledWith("g-1");
    expect(onGoalsChanged).toHaveBeenCalled();
  });

  test("感情ログが無ければ件数を出さない", async () => {
    mockFetchTaskIds.mockResolvedValue(["t1"]);
    mockCountEmotionLogs.mockResolvedValue(0);
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.press(screen.getByLabelText("大目標「公務員試験に合格する」を削除"));

    expect(await screen.findByText(/タスク 1 件/)).toBeTruthy();
    expect(screen.queryByText(/感情ログ/)).toBeNull();
  });

  test("「やめる」で削除しない", async () => {
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.press(screen.getByLabelText("大目標「公務員試験に合格する」を削除"));
    await screen.findByText(/タスク 0 件/);
    await fireEvent.press(screen.getByText("やめる"));

    expect(mockDeleteGoal).not.toHaveBeenCalled();
  });

  test("中目標も同様に削除できる", async () => {
    mockFetchTaskIds.mockResolvedValue(["t1"]);
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.press(screen.getByLabelText("中目標「ステップ1」を削除"));
    await screen.findByText(/タスク 1 件/);
    await fireEvent.press(screen.getByText("削除する"));

    expect(mockDeleteSubGoal).toHaveBeenCalledWith("sg-g-1");
    expect(mockDeleteGoal).not.toHaveBeenCalled();
  });

  test("中目標の削除では、その中目標配下だけを数える", async () => {
    await renderScreen([goalWithSubGoals("一次試験対策", "二次試験対策")]);

    await fireEvent.press(screen.getByLabelText("中目標「二次試験対策」を削除"));
    await screen.findByText(/タスク 0 件/);

    expect(mockFetchTaskIds).toHaveBeenLastCalledWith(["sg-2"]);
  });
});

describe("<GoalManagementScreen /> 中目標の表示件数", () => {
  function goalWithSubGoals(...titles: string[]): GoalWithSubGoals {
    return {
      ...makeGoal("g-1", "公務員試験に合格する"),
      sub_goals: titles.map((t, i) => makeSubGoal(`sg-${i + 1}`, "g-1", t)),
    };
  }

  test("3件以下なら全件表示し、展開ボタンを出さない", async () => {
    await renderScreen([goalWithSubGoals("A", "B", "C")]);

    expect(screen.getByDisplayValue("C")).toBeTruthy();
    expect(screen.queryByText(/件の中目標を表示/)).toBeNull();
  });

  test("4件以上は先頭3件のみ表示する", async () => {
    await renderScreen([goalWithSubGoals("A", "B", "C", "D", "E")]);

    expect(screen.getByDisplayValue("C")).toBeTruthy();
    expect(screen.queryByDisplayValue("D")).toBeNull();
    expect(screen.getByText("他 2 件の中目標を表示")).toBeTruthy();
  });

  test("展開すると全件表示し、折りたたみに切り替わる", async () => {
    await renderScreen([goalWithSubGoals("A", "B", "C", "D", "E")]);

    await fireEvent.press(screen.getByText("他 2 件の中目標を表示"));

    expect(screen.getByDisplayValue("E")).toBeTruthy();
    expect(screen.getByText("中目標を折りたたむ")).toBeTruthy();
  });
});

describe("<GoalManagementScreen /> タスクの表示件数", () => {
  function makeTask(id: string, title: string, status: TaskStatus = "todo"): Task {
    return {
      id,
      sub_goal_id: "sg-g-1",
      title,
      status,
      date: "2026-07-20",
      created_at: "2026-07-20T00:00:00Z",
      updated_at: "2026-07-20T00:00:00Z",
    };
  }

  test("3件以下なら全件出し、詳細への導線を出さない", async () => {
    mockFetchTasks.mockResolvedValue([makeTask("t1", "英単語"), makeTask("t2", "過去問")]);
    mockTaskCounts.mockResolvedValue({ "sg-g-1": 2 });
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    expect(await screen.findByText(/英単語/)).toBeTruthy();
    expect(screen.queryByText(/すべて見る/)).toBeNull();
  });

  test("4件以上は先頭3件のみ出し、総件数つきの導線を出す", async () => {
    mockFetchTasks.mockResolvedValue([
      makeTask("t1", "タスクA"),
      makeTask("t2", "タスクB"),
      makeTask("t3", "タスクC"),
      makeTask("t4", "タスクD"),
    ]);
    mockTaskCounts.mockResolvedValue({ "sg-g-1": 12 });
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    expect(await screen.findByText("すべて見る（12 件）")).toBeTruthy();
    expect(screen.getByText(/タスクC/)).toBeTruthy();
    expect(screen.queryByText(/タスクD/)).toBeNull();
  });

  test("導線から中目標の詳細へ遷移する", async () => {
    mockFetchTasks.mockResolvedValue([
      makeTask("t1", "タスクA"),
      makeTask("t2", "タスクB"),
      makeTask("t3", "タスクC"),
      makeTask("t4", "タスクD"),
    ]);
    mockTaskCounts.mockResolvedValue({ "sg-g-1": 4 });
    await renderScreen([makeGoal("g-1", "公務員試験に合格する")]);

    await fireEvent.press(await screen.findByLabelText("中目標「ステップ1」のタスクをすべて見る"));

    // 詳細画面に切り替わり、目標管理の見出しが消える
    expect(await screen.findByText("← 目標管理へ")).toBeTruthy();
    expect(screen.queryByText("目標管理")).toBeNull();
  });
});
