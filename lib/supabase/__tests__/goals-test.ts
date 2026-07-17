import { findDefaultSubGoalId, type GoalWithSubGoals } from "../goals";
import type { SubGoal } from "../../../types/database";

// goals.ts が import する Supabase クライアントは環境変数を要求するため、モックで置き換える
jest.mock("../client", () => ({ supabase: {} }));

function makeSubGoal(overrides: Partial<SubGoal> & Pick<SubGoal, "id" | "created_at">): SubGoal {
  return {
    goal_id: "goal-1",
    title: "中目標",
    is_provisional: false,
    updated_at: overrides.created_at,
    ...overrides,
  };
}

function makeGoal(id: string, subGoals: SubGoal[]): GoalWithSubGoals {
  return {
    id,
    user_id: "user-1",
    title: "大目標",
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    sub_goals: subGoals,
  };
}

describe("findDefaultSubGoalId", () => {
  test("ゴールが無いときは null を返す", () => {
    expect(findDefaultSubGoalId([])).toBeNull();
  });

  test("中目標が無いときは null を返す", () => {
    expect(findDefaultSubGoalId([makeGoal("goal-1", [])])).toBeNull();
  });

  test("仮の中目標があればそれを優先する", () => {
    const goals = [
      makeGoal("goal-1", [
        makeSubGoal({ id: "sg-named", created_at: "2026-07-10T00:00:00Z" }),
        makeSubGoal({ id: "sg-prov", created_at: "2026-07-05T00:00:00Z", is_provisional: true }),
      ]),
    ];
    // 命名済みの方が新しくても、仮の中目標が優先される
    expect(findDefaultSubGoalId(goals)).toBe("sg-prov");
  });

  test("仮の中目標が複数あれば最新のものを返す", () => {
    const goals = [
      makeGoal("goal-1", [
        makeSubGoal({ id: "sg-old", created_at: "2026-07-01T00:00:00Z", is_provisional: true }),
        makeSubGoal({ id: "sg-new", created_at: "2026-07-10T00:00:00Z", is_provisional: true }),
      ]),
    ];
    expect(findDefaultSubGoalId(goals)).toBe("sg-new");
  });

  test("仮の中目標が無ければ最新の中目標を返す", () => {
    const goals = [
      makeGoal("goal-1", [
        makeSubGoal({ id: "sg-1", created_at: "2026-07-01T00:00:00Z" }),
        makeSubGoal({ id: "sg-2", created_at: "2026-07-10T00:00:00Z" }),
      ]),
    ];
    expect(findDefaultSubGoalId(goals)).toBe("sg-2");
  });

  test("複数の大目標をまたいで探す", () => {
    const goals = [
      makeGoal("goal-1", [makeSubGoal({ id: "sg-a", created_at: "2026-07-01T00:00:00Z" })]),
      makeGoal("goal-2", [
        makeSubGoal({ id: "sg-b", created_at: "2026-07-03T00:00:00Z", is_provisional: true }),
      ]),
    ];
    expect(findDefaultSubGoalId(goals)).toBe("sg-b");
  });
});
