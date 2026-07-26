import { supabase } from "./client";
import type { ISODateString, Task, TaskStatus, UUID } from "../../types/database";

/** 指定日のタスクを取得する（RLSにより自ユーザーのタスクのみ返る） */
export async function fetchTasksForDate(date: ISODateString): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("date", date)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 期間内（開始日〜終了日、両端含む）のタスクを取得する（週次サマリー用） */
export async function fetchTasksForDateRange(
  start: ISODateString,
  end: ISODateString,
): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 中目標配下のタスクを取得する（目標管理画面用） */
export async function fetchTasksForSubGoals(subGoalIds: UUID[]): Promise<Task[]> {
  if (subGoalIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .in("sub_goal_id", subGoalIds)
    .order("date", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

/** 中目標1件の全タスクを取得する（中目標の詳細画面用。件数を打ち切らない） */
export async function fetchTasksForSubGoal(subGoalId: UUID): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("sub_goal_id", subGoalId)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * 中目標ごとのタスク件数を数える。
 * 一覧では先頭数件しか描かないが、「すべて見る（N件）」の N には正確な値が要るため、
 * sub_goal_id だけを引いて件数を集計する（表示用の取得は50件で打ち切っているので使えない）。
 */
export async function fetchTaskCountsBySubGoal(
  subGoalIds: UUID[],
): Promise<Record<UUID, number>> {
  if (subGoalIds.length === 0) return {};
  const { data, error } = await supabase
    .from("tasks")
    .select("sub_goal_id")
    .in("sub_goal_id", subGoalIds);
  if (error) throw error;

  const counts: Record<UUID, number> = {};
  for (const row of data ?? []) {
    counts[row.sub_goal_id] = (counts[row.sub_goal_id] ?? 0) + 1;
  }
  return counts;
}

/**
 * 中目標配下の全タスクIDを取得する（削除時の影響範囲を数えるため）。
 * fetchTasksForSubGoals は表示用に50件で打ち切っているので、件数集計には使えない。
 */
export async function fetchTaskIdsForSubGoals(subGoalIds: UUID[]): Promise<UUID[]> {
  if (subGoalIds.length === 0) return [];
  const { data, error } = await supabase
    .from("tasks")
    .select("id")
    .in("sub_goal_id", subGoalIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.id);
}

export async function createTask(params: {
  subGoalId: UUID;
  title: string;
  date: ISODateString;
}): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      sub_goal_id: params.subGoalId,
      title: params.title,
      status: "todo",
      date: params.date,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskStatus(taskId: UUID, status: TaskStatus): Promise<void> {
  const { error } = await supabase.from("tasks").update({ status }).eq("id", taskId);
  if (error) throw error;
}

export async function updateTaskTitle(taskId: UUID, title: string): Promise<void> {
  const { error } = await supabase.from("tasks").update({ title }).eq("id", taskId);
  if (error) throw error;
}

/** タスクを削除する。紐づく感情ログもDBのon delete cascadeで同時に消える */
export async function deleteTask(taskId: UUID): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function reassignTask(taskId: UUID, subGoalId: UUID): Promise<void> {
  const { error } = await supabase.from("tasks").update({ sub_goal_id: subGoalId }).eq("id", taskId);
  if (error) throw error;
}
