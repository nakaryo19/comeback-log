import type { UserDataDump } from "../supabase/export";
import type { EmotionLog, Task, TaskStatus } from "../../types/database";

/**
 * 表計算ソフトで開けるCSVを組み立てる。
 *
 * JSONは中身を完全に保持できるが、受け取った本人が開いても読みにくい。
 * 控えとして役に立つのは「開いてそのまま読める」ことなので、
 * 1行＝1タスクの表に平坦化したものを既定の形式とする。
 */
const HEADERS = [
  "日付",
  "大目標",
  "中目標",
  "タスク",
  "状態",
  "感情スコア",
  "タグ",
  "メモ",
] as const;

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "未完了",
  done: "完了",
  partial: "部分達成",
};

/**
 * Excel は UTF-8 のCSVをそのまま開くと日本語が文字化けする。
 * BOM を先頭に付けると UTF-8 と判別される。
 */
const BOM = "﻿";

export function buildCsv(dump: UserDataDump): string {
  const goalTitleById = new Map(dump.goals.map((goal) => [goal.id, goal.title]));
  const subGoalById = new Map(dump.subGoals.map((subGoal) => [subGoal.id, subGoal]));
  const logByTaskId = new Map<string, EmotionLog>(
    dump.emotionLogs.map((log) => [log.task_id, log]),
  );

  // 日付順に並べる。表計算ソフトで開いたとき、そのまま時系列で読み返せるようにする
  const tasks = [...dump.tasks].sort((a, b) => a.date.localeCompare(b.date));

  const rows = tasks.map((task) => toRow(task, subGoalById, goalTitleById, logByTaskId));
  return BOM + [HEADERS, ...rows].map(toCsvLine).join("\r\n");
}

function toRow(
  task: Task,
  subGoalById: Map<string, { goal_id: string; title: string }>,
  goalTitleById: Map<string, string>,
  logByTaskId: Map<string, EmotionLog>,
): string[] {
  const subGoal = subGoalById.get(task.sub_goal_id);
  const log = logByTaskId.get(task.id);
  return [
    task.date,
    (subGoal && goalTitleById.get(subGoal.goal_id)) ?? "",
    subGoal?.title ?? "",
    task.title,
    STATUS_LABELS[task.status],
    // 記録が無い場合は空欄にする。0 と書くと「スコア0を付けた」ように読めてしまう
    log ? String(log.score) : "",
    log?.tag ?? "",
    log?.free_text ?? "",
  ];
}

function toCsvLine(cells: readonly string[]): string {
  return cells.map(escapeCell).join(",");
}

/**
 * 自由記述には改行・カンマ・引用符が入り得る。
 * 常に引用し、内部の引用符は二重にする（RFC 4180）。
 */
function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
