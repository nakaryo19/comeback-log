import { supabase } from "./client";
import type { EmotionLog, Goal, SubGoal, Task } from "../../types/database";

/** 書き出しの対象となる、自分の全データ */
export type UserDataDump = {
  goals: Goal[];
  subGoals: SubGoal[];
  tasks: Task[];
  emotionLogs: EmotionLog[];
};

/**
 * 自分の全データを取得する。
 *
 * user_id で絞っていないのは、RLS により自分の行しか見えないため
 * （supabase/migrations/20260713000000_initial_schema.sql）。
 *
 * ここは可視化と違い、free_text も含めて取得する。開示請求への対応手段であり、
 * かつ無料枠にバックアップが無い以上、利用者自身が持つ控えが唯一の復旧手段になるため
 * （docs/運用/商用リリース前チェックリスト.md §3-2）。本人の端末へ渡すだけで、
 * 外部へ送信するものではない。
 */
export async function fetchAllUserData(): Promise<UserDataDump> {
  const [goals, subGoals, tasks, emotionLogs] = await Promise.all([
    selectAll<Goal>("goals"),
    selectAll<SubGoal>("sub_goals"),
    selectAll<Task>("tasks"),
    selectAll<EmotionLog>("emotion_logs"),
  ]);
  return { goals, subGoals, tasks, emotionLogs };
}

async function selectAll<T>(table: "goals" | "sub_goals" | "tasks" | "emotion_logs"): Promise<T[]> {
  const { data, error } = await supabase.from(table).select("*").order("created_at");
  if (error) throw error;
  return (data ?? []) as T[];
}
