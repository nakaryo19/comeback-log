import { supabase } from "./client";
import type { EmotionScore, UUID } from "../../types/database";

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
