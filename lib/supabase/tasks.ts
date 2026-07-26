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
