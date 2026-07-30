import { buildCsv } from "../buildCsv";
import type { UserDataDump } from "../../supabase/export";
import type { EmotionLog, Goal, SubGoal, Task } from "../../../types/database";

const TIMESTAMP = "2026-07-01T00:00:00.000Z";

const goal: Goal = {
  id: "g1",
  user_id: "u1",
  title: "簿記2級に合格する",
  achieved_at: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

const subGoal: SubGoal = {
  id: "s1",
  goal_id: "g1",
  title: "商業簿記を終わらせる",
  is_provisional: false,
  achieved_at: null,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
};

function task(id: string, date: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    sub_goal_id: "s1",
    title: `タスク${id}`,
    status: "done",
    date,
    created_at: TIMESTAMP,
    updated_at: TIMESTAMP,
    ...overrides,
  };
}

function log(taskId: string, overrides: Partial<EmotionLog> = {}): EmotionLog {
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

function dumpWith(tasks: Task[], emotionLogs: EmotionLog[] = []): UserDataDump {
  return { goals: [goal], subGoals: [subGoal], tasks, emotionLogs };
}

/** BOM を除いた行の配列にする */
function lines(csv: string): string[] {
  return csv.replace(/^﻿/, "").split("\r\n");
}

test("先頭に見出し行を置く", () => {
  expect(lines(buildCsv(dumpWith([])))[0]).toBe(
    '"日付","大目標","中目標","タスク","状態","感情スコア","タグ","メモ"',
  );
});

test("Excel が文字化けしないよう BOM を付ける", () => {
  expect(buildCsv(dumpWith([])).startsWith("﻿")).toBe(true);
});

test("1行が1タスクで、目標名と感情の記録が同じ行に並ぶ", () => {
  const csv = buildCsv(dumpWith([task("t1", "2026-07-10")], [log("t1", { free_text: "順調" })]));

  expect(lines(csv)[1]).toBe(
    '"2026-07-10","簿記2級に合格する","商業簿記を終わらせる","タスクt1","完了","4","集中","順調"',
  );
});

test("感情の記録が無い行はスコアを空欄にする（0と区別する）", () => {
  const csv = buildCsv(dumpWith([task("t1", "2026-07-10")]));

  expect(lines(csv)[1]).toBe(
    '"2026-07-10","簿記2級に合格する","商業簿記を終わらせる","タスクt1","完了","","",""',
  );
});

test("状態を日本語のラベルにする", () => {
  const csv = buildCsv(
    dumpWith([
      task("t1", "2026-07-10", { status: "todo" }),
      task("t2", "2026-07-11", { status: "partial" }),
    ]),
  );

  expect(lines(csv)[1]).toContain('"未完了"');
  expect(lines(csv)[2]).toContain('"部分達成"');
});

test("日付順に並べる", () => {
  const csv = buildCsv(
    dumpWith([task("t2", "2026-07-20"), task("t1", "2026-07-05"), task("t3", "2026-07-12")]),
  );

  expect(lines(csv).slice(1).map((line) => line.split(",")[0])).toEqual([
    '"2026-07-05"',
    '"2026-07-12"',
    '"2026-07-20"',
  ]);
});

test("メモの引用符・カンマ・改行で列がずれない", () => {
  const csv = buildCsv(
    dumpWith(
      [task("t1", "2026-07-10")],
      [log("t1", { free_text: '「"無理"かも」と思ったが,\n続けられた' })],
    ),
  );

  // 改行を含むセルは引用符の内側に入るため、行としては見出し＋1件＋改行分の断片になる
  expect(csv).toContain('"「""無理""かも」と思ったが,\n続けられた"');
});
