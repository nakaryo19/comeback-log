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

/** 可視化に使う感情ログの中身。free_text は含めない */
export type EmotionEntry = {
  score: EmotionScore;
  tag: string | null;
};

/**
 * 指定タスク群の感情ログを task_id 付きで取得する（グラフ・集計用）。
 *
 * fetchEmotionScoresForTasks はスコアだけを返すため、「どの日のスコアか」が分からない。
 * 日単位・週単位で集計するには task_id を残し、タスクの日付と突き合わせる必要がある。
 * free_text は取得しない。可視化に不要な自由記述を、必要のない場所へ運ばないため
 * （CLAUDE.md「感情ログのプライバシーを最優先する」）。
 */
export async function fetchEmotionEntriesByTaskId(
  taskIds: UUID[],
): Promise<Map<UUID, EmotionEntry>> {
  if (taskIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("emotion_logs")
    .select("task_id, score, tag")
    .in("task_id", taskIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.task_id, { score: row.score, tag: row.tag }]));
}

/** 上記のうちスコアだけが要る呼び出し向け（クエリの定義を1箇所に保つため委譲する） */
export async function fetchEmotionScoresByTaskId(
  taskIds: UUID[],
): Promise<Map<UUID, EmotionScore>> {
  const entries = await fetchEmotionEntriesByTaskId(taskIds);
  return new Map([...entries].map(([taskId, entry]) => [taskId, entry.score]));
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

/**
 * 指定タスク群に紐づく感情ログの件数を数える（削除時の影響範囲の提示用）。
 * 本文は取得しない。件数だけを返す。
 */
export async function countEmotionLogsForTasks(taskIds: UUID[]): Promise<number> {
  if (taskIds.length === 0) return 0;
  const { count, error } = await supabase
    .from("emotion_logs")
    .select("task_id", { count: "exact", head: true })
    .in("task_id", taskIds);
  if (error) throw error;
  return count ?? 0;
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
