import { fireEvent, render, screen } from "@testing-library/react-native";
import { SubGoalDetail } from "../SubGoalDetail";
import { fetchTasksForSubGoal } from "../../../lib/supabase/tasks";
import type { SubGoal, Task, TaskStatus } from "../../../types/database";

jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForSubGoal: jest.fn(),
}));

const mockFetch = fetchTasksForSubGoal as jest.MockedFunction<typeof fetchTasksForSubGoal>;

const subGoal: SubGoal = {
  id: "sg-1",
  goal_id: "g-1",
  title: "一次試験対策",
  is_provisional: false,
  achieved_at: null,
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
};

function makeTask(id: string, title: string, status: TaskStatus, date: string): Task {
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

async function setup(tasks: Task[]) {
  mockFetch.mockResolvedValue(tasks);
  const onBack = jest.fn();
  await render(<SubGoalDetail subGoal={subGoal} onBack={onBack} />);
  return { onBack };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("<SubGoalDetail />", () => {
  test("中目標名と、その中目標の全タスクを表示する", async () => {
    await setup([
      makeTask("t1", "英単語100個", "done", "2026-07-20"),
      makeTask("t2", "過去問1年分", "todo", "2026-07-19"),
      makeTask("t3", "模試の復習", "partial", "2026-07-18"),
      makeTask("t4", "判例チェック", "done", "2026-07-17"),
    ]);

    expect(await screen.findByText("一次試験対策")).toBeTruthy();
    // 一覧側の3件制限を受けず、4件目も表示される
    expect(screen.getByText("判例チェック")).toBeTruthy();
    expect(mockFetch).toHaveBeenCalledWith("sg-1");
  });

  test("全件数と完了件数を表示する", async () => {
    await setup([
      makeTask("t1", "A", "done", "2026-07-20"),
      makeTask("t2", "B", "todo", "2026-07-19"),
      makeTask("t3", "C", "done", "2026-07-18"),
    ]);

    expect(await screen.findByText("全 3 件 / 完了 2 件")).toBeTruthy();
  });

  test("各タスクの状態ラベルを表示する", async () => {
    await setup([
      makeTask("t1", "A", "done", "2026-07-20"),
      makeTask("t2", "B", "partial", "2026-07-19"),
      makeTask("t3", "C", "todo", "2026-07-18"),
    ]);

    expect(await screen.findByText("完了")).toBeTruthy();
    expect(screen.getByText("部分達成")).toBeTruthy();
    expect(screen.getByText("未完了")).toBeTruthy();
  });

  test("タスクが無ければ空の案内を出す", async () => {
    await setup([]);

    expect(await screen.findByText("この中目標のタスクはまだありません")).toBeTruthy();
  });

  test("戻る導線で onBack を呼ぶ", async () => {
    const { onBack } = await setup([]);

    await fireEvent.press(screen.getByText("← 目標管理へ"));

    expect(onBack).toHaveBeenCalled();
  });

  test("取得に失敗したらエラーを表示する", async () => {
    mockFetch.mockRejectedValue(new Error("取得できませんでした"));
    await render(<SubGoalDetail subGoal={subGoal} onBack={jest.fn()} />);

    expect(await screen.findByText("取得できませんでした")).toBeTruthy();
  });
});
