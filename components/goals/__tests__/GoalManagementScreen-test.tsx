import { fireEvent, render, screen } from "@testing-library/react-native";
import { GoalManagementScreen } from "../GoalManagementScreen";
import { createGoal, renameGoal, type GoalWithSubGoals } from "../../../lib/supabase/goals";
import { fetchTasksForSubGoals } from "../../../lib/supabase/tasks";
import { useAuth } from "../../../lib/supabase/auth-context";
import type { SubGoal } from "../../../types/database";

jest.mock("../../../lib/supabase/goals", () => ({
  createGoal: jest.fn(),
  renameGoal: jest.fn(),
  createSubGoal: jest.fn(),
  renameSubGoal: jest.fn(),
}));
jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForSubGoals: jest.fn(),
  reassignTask: jest.fn(),
}));
jest.mock("../../../lib/supabase/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockCreateGoal = createGoal as jest.MockedFunction<typeof createGoal>;
const mockRenameGoal = renameGoal as jest.MockedFunction<typeof renameGoal>;
const mockFetchTasks = fetchTasksForSubGoals as jest.MockedFunction<typeof fetchTasksForSubGoals>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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
