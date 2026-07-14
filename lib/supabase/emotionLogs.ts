import { supabase } from "./client";
import type { EmotionLog, EmotionScore, UUID } from "../../types/database";

/** 指定タスク群に紐づく感情スコアを取得する（RLSにより自ユーザーの記録のみ返る） */
export async function fetchEmotionScoresForTasks(taskIds: UUID[]): Promise<EmotionScore[]> {
  if (taskIds.length === 0) return [];
  const { data, error } = await supabase
    .from("emotion_logs")
    .select("score")
    .in("task_id", taskIds);
  if (error) throw error;
  return (data ?? []).map((row) => row.score);
}

/** 指定タスク群のうち、すでに感情ログが記録済みのtask_idを取得する */
export async function fetchLoggedTaskIds(taskIds: UUID[]): Promise<Set<UUID>> {
  if (taskIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from("emotion_logs")
    .select("task_id")
    .in("task_id", taskIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.task_id));
}

export async function createEmotionLog(params: {
  taskId: UUID;
  score: EmotionScore;
  tag: string | null;
  freeText: string | null;
}): Promise<EmotionLog> {
  const { data, error } = await supabase
    .from("emotion_logs")
    .insert({
      task_id: params.taskId,
      score: params.score,
      tag: params.tag,
      free_text: params.freeText,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
