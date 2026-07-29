import { fireEvent, render, screen } from "@testing-library/react-native";
import { HomeScreen } from "../HomeScreen";
import { formatShortDate, shiftDateString, todayDateString } from "../../../lib/date";
import {
  createTask,
  deleteTask,
  fetchTasksForDate,
  fetchTasksForDateRange,
  updateTaskTitle,
} from "../../../lib/supabase/tasks";
import { fetchEmotionScoresForTasks, fetchLoggedTaskIds } from "../../../lib/supabase/emotionLogs";
import type { GoalWithSubGoals } from "../../../lib/supabase/goals";
import type { SubGoal, Task, TaskStatus } from "../../../types/database";

jest.mock("../../../lib/supabase/tasks", () => ({
  fetchTasksForDate: jest.fn(),
  fetchTasksForDateRange: jest.fn(),
  createTask: jest.fn(),
  updateTaskStatus: jest.fn(),
  updateTaskTitle: jest.fn(),
  deleteTask: jest.fn(),
}));
jest.mock("../../../lib/supabase/emotionLogs", () => ({
  fetchLoggedTaskIds: jest.fn(),
  fetchEmotionScoresForTasks: jest.fn(),
  fetchEmotionScoresByTaskId: jest.fn(() => Promise.resolve(new Map())),
  createEmotionLog: jest.fn(),
}));
// selectableSubGoals は純粋関数なので実物を使う（候補の絞り込み自体を検証したいため）。
// 実物の goals.ts は Supabase クライアントを import するので、client 側をモックしておく。
jest.mock("../../../lib/supabase/client", () => ({ supabase: {} }));
jest.mock("../../../lib/supabase/goals", () => ({
  ...jest.requireActual("../../../lib/supabase/goals"),
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
const mockUpdateTaskTitle = updateTaskTitle as jest.MockedFunction<typeof updateTaskTitle>;
const mockDeleteTask = deleteTask as jest.MockedFunction<typeof deleteTask>;

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
    achieved_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    sub_goals: [],
  },
];

/** 日付ごとのタスクを返すようモックを仕込む */
function stubTasksByDate(tasksByDate: Record<string, Task[]>) {
  mockFetchTasksForDate.mockImplementation(async (date) => tasksByDate[date] ?? []);
}

async function renderHome(withGoals: GoalWithSubGoals[] = goals) {
  return await render(
    <HomeScreen
      goals={withGoals}
      onOpenGoalManagement={jest.fn()}
      onOpenAnalytics={jest.fn()}
    />,
  );
}

function makeSubGoal(id: string, title: string, isProvisional = false): SubGoal {
  return {
    id,
    goal_id: "g-1",
    title,
    is_provisional: isProvisional,
    achieved_at: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchLoggedTaskIds.mockResolvedValue(new Set());
  mockFetchTasksForDateRange.mockResolvedValue([]);
  mockFetchEmotionScores.mockResolvedValue([]);
  mockUpdateTaskTitle.mockResolvedValue(undefined);
  mockDeleteTask.mockResolvedValue(undefined);
  stubTasksByDate({});
});

describe("<HomeScreen /> 日付切り替え", () => {

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

describe("<HomeScreen /> タスクの編集・削除", () => {
  async function renderWithTask(logged = false) {
    stubTasksByDate({ [TODAY]: [makeTask("t1", "英単語100個", TODAY)] });
    if (logged) mockFetchLoggedTaskIds.mockResolvedValue(new Set(["t1"]));
    await renderHome();
    await screen.findByText("英単語100個");
  }

  test("「編集」でタイトルを書き換えて保存できる", async () => {
    await renderWithTask();

    await fireEvent.press(screen.getByText("編集"));
    await fireEvent.changeText(screen.getByDisplayValue("英単語100個"), "英単語150個");
    await fireEvent.press(screen.getByText("保存"));

    expect(mockUpdateTaskTitle).toHaveBeenCalledWith("t1", "英単語150個");
    expect(await screen.findByText("英単語150個")).toBeTruthy();
  });

  test("「やめる」で編集を破棄する", async () => {
    await renderWithTask();

    await fireEvent.press(screen.getByText("編集"));
    await fireEvent.changeText(screen.getByDisplayValue("英単語100個"), "書きかけ");
    await fireEvent.press(screen.getByText("やめる"));

    expect(mockUpdateTaskTitle).not.toHaveBeenCalled();
    expect(screen.getByText("英単語100個")).toBeTruthy();
  });

  test("空文字では保存せず、元のタイトルのままにする", async () => {
    await renderWithTask();

    await fireEvent.press(screen.getByText("編集"));
    await fireEvent.changeText(screen.getByDisplayValue("英単語100個"), "   ");
    await fireEvent.press(screen.getByText("保存"));

    expect(mockUpdateTaskTitle).not.toHaveBeenCalled();
    expect(screen.getByText("英単語100個")).toBeTruthy();
  });

  test("「削除」は確認を挟んでから削除する", async () => {
    await renderWithTask();

    await fireEvent.press(screen.getByText("削除"));
    expect(mockDeleteTask).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("削除する"));
    expect(mockDeleteTask).toHaveBeenCalledWith("t1");
    expect(screen.queryByText("英単語100個")).toBeNull();
  });

  test("確認を「やめる」で閉じると削除しない", async () => {
    await renderWithTask();

    await fireEvent.press(screen.getByText("削除"));
    await fireEvent.press(screen.getByText("やめる"));

    expect(mockDeleteTask).not.toHaveBeenCalled();
    expect(screen.getByText("英単語100個")).toBeTruthy();
  });

  test("感情ログが記録済みのタスクは、ログも消える旨を確認文に添える", async () => {
    await renderWithTask(true);

    await fireEvent.press(screen.getByText("削除"));

    expect(screen.getByText(/記録した感情ログも一緒に削除されます。/)).toBeTruthy();
  });
});

describe("<HomeScreen /> タスク追加時の中目標選択", () => {
  const multiSubGoals: GoalWithSubGoals[] = [
    {
      ...goals[0],
      sub_goals: [
        makeSubGoal("sg-1", "ステップ1", true),
        makeSubGoal("sg-2", "一次試験対策"),
        makeSubGoal("sg-3", "二次試験対策"),
      ],
    },
  ];

  test("中目標が1つだけなら選択UIを出さない", async () => {
    const single: GoalWithSubGoals[] = [
      { ...goals[0], sub_goals: [makeSubGoal("sg-1", "ステップ1", true)] },
    ];
    await renderHome(single);
    await screen.findByPlaceholderText("今日のタスクを追加");

    expect(screen.queryByText("追加先の中目標")).toBeNull();
  });

  test("中目標が複数あれば選択でき、未選択なら既定の中目標に割り当てる", async () => {
    mockCreateTask.mockResolvedValue(makeTask("t9", "復習", TODAY));
    await renderHome(multiSubGoals);

    expect(await screen.findByText("追加先の中目標")).toBeTruthy();

    await fireEvent.changeText(screen.getByPlaceholderText("今日のタスクを追加"), "復習");
    await fireEvent.press(screen.getByText("追加"));

    // findDefaultSubGoalId のモックが返す "sg-1"（直近の仮中目標）
    expect(mockCreateTask).toHaveBeenCalledWith({
      subGoalId: "sg-1",
      title: "復習",
      date: TODAY,
    });
  });

  test("選んだ中目標に紐づけてタスクを作成する", async () => {
    mockCreateTask.mockResolvedValue(makeTask("t9", "過去問", TODAY));
    await renderHome(multiSubGoals);
    await screen.findByText("追加先の中目標");

    await fireEvent.press(screen.getByText("二次試験対策"));
    await fireEvent.changeText(screen.getByPlaceholderText("今日のタスクを追加"), "過去問");
    await fireEvent.press(screen.getByText("追加"));

    expect(mockCreateTask).toHaveBeenCalledWith({
      subGoalId: "sg-3",
      title: "過去問",
      date: TODAY,
    });
  });

  test("選択は次のタスク追加にも引き継がれる", async () => {
    mockCreateTask.mockResolvedValue(makeTask("t9", "x", TODAY));
    await renderHome(multiSubGoals);
    await screen.findByText("追加先の中目標");

    await fireEvent.press(screen.getByText("一次試験対策"));
    await fireEvent.changeText(screen.getByPlaceholderText("今日のタスクを追加"), "1本目");
    await fireEvent.press(screen.getByText("追加"));
    await fireEvent.changeText(screen.getByPlaceholderText("今日のタスクを追加"), "2本目");
    await fireEvent.press(screen.getByText("追加"));

    expect(mockCreateTask).toHaveBeenLastCalledWith({
      subGoalId: "sg-2",
      title: "2本目",
      date: TODAY,
    });
  });

  test("大目標が複数あるときは「大目標 / 中目標」で区別できるようにする", async () => {
    const twoGoals: GoalWithSubGoals[] = [
      { ...goals[0], sub_goals: [makeSubGoal("sg-1", "ステップ1", true)] },
      {
        ...goals[0],
        id: "g-2",
        title: "簿記2級に合格する",
        sub_goals: [makeSubGoal("sg-9", "商業簿記")],
      },
    ];
    await renderHome(twoGoals);

    expect(await screen.findByText("公務員試験に合格する / ステップ1")).toBeTruthy();
    expect(screen.getByText("簿記2級に合格する / 商業簿記")).toBeTruthy();
  });
});

describe("<HomeScreen /> 達成済みの中目標は選べない", () => {
  const ACHIEVED = "2026-07-20T00:00:00Z";

  test("達成済みの中目標は選択肢に出さない", async () => {
    const withAchieved: GoalWithSubGoals[] = [
      {
        ...goals[0],
        sub_goals: [
          makeSubGoal("sg-1", "ステップ1", true),
          { ...makeSubGoal("sg-2", "一次試験対策"), achieved_at: ACHIEVED },
          makeSubGoal("sg-3", "二次試験対策"),
        ],
      },
    ];
    await renderHome(withAchieved);
    await screen.findByText("追加先の中目標");

    expect(screen.queryByText("一次試験対策")).toBeNull();
    expect(screen.getByText("二次試験対策")).toBeTruthy();
  });

  test("達成済みの大目標は配下ごと選択肢に出さない", async () => {
    const twoGoals: GoalWithSubGoals[] = [
      { ...goals[0], sub_goals: [makeSubGoal("sg-1", "ステップ1", true)] },
      {
        ...goals[0],
        id: "g-2",
        title: "簿記2級に合格する",
        achieved_at: ACHIEVED,
        sub_goals: [makeSubGoal("sg-9", "商業簿記")],
      },
    ];
    await renderHome(twoGoals);
    await screen.findByPlaceholderText("今日のタスクを追加");

    expect(screen.queryByText("商業簿記")).toBeNull();
    // 選べる大目標が1つだけになるので、大目標名の前置きも消える
    expect(screen.queryByText("公務員試験に合格する / ステップ1")).toBeNull();
  });

  test("残る中目標が1つだけになれば選択UI自体を出さない", async () => {
    const withAchieved: GoalWithSubGoals[] = [
      {
        ...goals[0],
        sub_goals: [
          makeSubGoal("sg-1", "ステップ1", true),
          { ...makeSubGoal("sg-2", "一次試験対策"), achieved_at: ACHIEVED },
        ],
      },
    ];
    await renderHome(withAchieved);
    await screen.findByPlaceholderText("今日のタスクを追加");

    expect(screen.queryByText("追加先の中目標")).toBeNull();
  });

  test("すべて達成済みなら、タスクの行き先が無くならないよう候補に戻す", async () => {
    const allAchieved: GoalWithSubGoals[] = [
      {
        ...goals[0],
        achieved_at: ACHIEVED,
        sub_goals: [
          { ...makeSubGoal("sg-1", "ステップ1", true), achieved_at: ACHIEVED },
          { ...makeSubGoal("sg-2", "一次試験対策"), achieved_at: ACHIEVED },
        ],
      },
    ];
    await renderHome(allAchieved);

    expect(await screen.findByText("追加先の中目標")).toBeTruthy();
    expect(screen.getByText("一次試験対策")).toBeTruthy();
  });
});

describe("<HomeScreen /> 先の予定の登録", () => {
  const TOMORROW = shiftDateString(TODAY, 1);

  test("「翌日」で未来日へ進み、その日付のタスクとして作成する", async () => {
    stubTasksByDate({ [TOMORROW]: [] });
    mockCreateTask.mockResolvedValue(makeTask("t9", "模試を受ける", TOMORROW));
    await renderHome();
    await screen.findByPlaceholderText("今日のタスクを追加");

    await fireEvent.press(screen.getByLabelText("翌日"));

    const input = await screen.findByPlaceholderText(`${formatShortDate(TOMORROW)}のタスクを追加`);
    await fireEvent.changeText(input, "模試を受ける");
    await fireEvent.press(screen.getByText("追加"));

    expect(mockCreateTask).toHaveBeenCalledWith({
      subGoalId: "sg-1",
      title: "模試を受ける",
      date: TOMORROW,
    });
  });

  test("未来日では見出しを「これからの予定」にする", async () => {
    await renderHome();
    await screen.findByPlaceholderText("今日のタスクを追加");

    await fireEvent.press(screen.getByLabelText("翌日"));

    expect(await screen.findByText("これからの予定")).toBeTruthy();
    expect(screen.getByText(`${formatShortDate(TOMORROW)}のタスク`)).toBeTruthy();
  });

  test("何日でも先へ進める", async () => {
    const nextWeek = shiftDateString(TODAY, 7);
    stubTasksByDate({ [nextWeek]: [makeTask("t9", "模試を受ける", nextWeek)] });
    await renderHome();
    await screen.findByPlaceholderText("今日のタスクを追加");

    for (let i = 0; i < 7; i++) {
      await fireEvent.press(screen.getByLabelText("翌日"));
    }

    expect(await screen.findByText("模試を受ける")).toBeTruthy();
    expect(mockFetchTasksForDate).toHaveBeenCalledWith(nextWeek);
  });
});
