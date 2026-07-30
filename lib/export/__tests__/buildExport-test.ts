import { buildExportPayload, exportFileName } from "../buildExport";
import type { UserDataDump } from "../../supabase/export";
import type { EmotionLog, Goal, SubGoal, Task } from "../../../types/database";

const TIMESTAMP = "2026-07-01T00:00:00.000Z";

function goal(id: string, overrides: Partial<Goal> = {}): Goal {
  return {
    id,
    user_id: "user-1",
    title: `目標${id}`,
    achieved_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

function subGoal(id: string, goalId: string, overrides: Partial<SubGoal> = {}): SubGoal {
  return {
    id,
    goal_id: goalId,
    title: `中目標${id}`,
    is_provisional: false,
    achieved_at: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

function task(id: string, subGoalId: string, date: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    sub_goal_id: subGoalId,
    title: `タスク${id}`,
    status: "todo",
    date,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

function emotionLog(taskId: string, overrides: Partial<EmotionLog> = {}): EmotionLog {
  return {
    id: `log-${taskId}`,
    task_id: taskId,
    score: 4,
    tag: "集中",
    free_text: null,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

const emptyDump: UserDataDump = { goals: [], subGoals: [], tasks: [], emotionLogs: [] };

describe("buildExportPayload", () => {
  test("大目標→中目標→タスク→感情の記録の入れ子にする", () => {
    const dump: UserDataDump = {
      goals: [goal("g1")],
      subGoals: [subGoal("s1", "g1")],
      tasks: [task("t1", "s1", "2026-07-10")],
      emotionLogs: [emotionLog("t1", { free_text: "今日はよく進んだ" })],
    };

    const payload = buildExportPayload(dump);

    expect(payload.goals).toHaveLength(1);
    expect(payload.goals[0].sub_goals[0].tasks[0]).toEqual({
      title: "タスクt1",
      status: "todo",
      date: "2026-07-10",
      emotion_log: {
        score: 4,
        tag: "集中",
        free_text: "今日はよく進んだ",
        recorded_at: TIMESTAMP,
      },
    });
  });

  test("自由記述も書き出す（本人の控えとして使えることが目的のため）", () => {
    const dump: UserDataDump = {
      goals: [goal("g1")],
      subGoals: [subGoal("s1", "g1")],
      tasks: [task("t1", "s1", "2026-07-10")],
      emotionLogs: [emotionLog("t1", { free_text: "焦っていた" })],
    };

    const json = JSON.stringify(buildExportPayload(dump));

    expect(json).toContain("焦っていた");
  });

  test("感情の記録が無いタスクは null にする（0点と区別する）", () => {
    const dump: UserDataDump = {
      goals: [goal("g1")],
      subGoals: [subGoal("s1", "g1")],
      tasks: [task("t1", "s1", "2026-07-10")],
      emotionLogs: [],
    };

    expect(buildExportPayload(dump).goals[0].sub_goals[0].tasks[0].emotion_log).toBeNull();
  });

  test("タスクは実施日の順に並べる", () => {
    const dump: UserDataDump = {
      goals: [goal("g1")],
      subGoals: [subGoal("s1", "g1")],
      tasks: [
        task("t2", "s1", "2026-07-20"),
        task("t1", "s1", "2026-07-05"),
        task("t3", "s1", "2026-07-12"),
      ],
      emotionLogs: [],
    };

    const dates = buildExportPayload(dump).goals[0].sub_goals[0].tasks.map((t) => t.date);

    expect(dates).toEqual(["2026-07-05", "2026-07-12", "2026-07-20"]);
  });

  test("別の大目標のタスクが混ざらない", () => {
    const dump: UserDataDump = {
      goals: [goal("g1"), goal("g2")],
      subGoals: [subGoal("s1", "g1"), subGoal("s2", "g2")],
      tasks: [task("t1", "s1", "2026-07-10"), task("t2", "s2", "2026-07-11")],
      emotionLogs: [],
    };

    const payload = buildExportPayload(dump);

    expect(payload.goals[0].sub_goals[0].tasks.map((t) => t.title)).toEqual(["タスクt1"]);
    expect(payload.goals[1].sub_goals[0].tasks.map((t) => t.title)).toEqual(["タスクt2"]);
  });

  test("件数と書き出し日時を添える", () => {
    const dump: UserDataDump = {
      goals: [goal("g1")],
      subGoals: [subGoal("s1", "g1")],
      tasks: [task("t1", "s1", "2026-07-10"), task("t2", "s1", "2026-07-11")],
      emotionLogs: [emotionLog("t1")],
    };

    const payload = buildExportPayload(dump, new Date("2026-07-31T09:00:00.000Z"));

    expect(payload.counts).toEqual({ goals: 1, sub_goals: 1, tasks: 2, emotion_logs: 1 });
    expect(payload.exported_at).toBe("2026-07-31T09:00:00.000Z");
    expect(payload.format_version).toBe(1);
  });

  test("データが無くても壊れない", () => {
    const payload = buildExportPayload(emptyDump);

    expect(payload.goals).toEqual([]);
    expect(payload.counts.tasks).toBe(0);
  });
});

describe("exportFileName", () => {
  test("日付入りのファイル名にする（複数回書き出しても上書きにならない）", () => {
    expect(exportFileName("csv", "2026-07-31")).toBe("comeback-log-2026-07-31.csv");
    expect(exportFileName("json", "2026-07-31")).toBe("comeback-log-2026-07-31.json");
  });
});
