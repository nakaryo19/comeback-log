import { supabase } from "./client";

/** 削除で失われる件数。確認画面で具体的に示すために数える */
export type AccountDataSummary = {
  goals: number;
  tasks: number;
  emotionLogs: number;
};

/**
 * 自分のデータ件数を数える。
 *
 * user_id で絞っていないのは、RLS により自分の行しか見えないため
 * （supabase/migrations/20260713000000_initial_schema.sql）。
 * 本文は一切取得しない。件数だけを返す。
 */
export async function fetchAccountDataSummary(): Promise<AccountDataSummary> {
  const [goals, tasks, emotionLogs] = await Promise.all([
    countRows("goals"),
    countRows("tasks"),
    countRows("emotion_logs"),
  ]);
  return { goals, tasks, emotionLogs };
}

async function countRows(table: "goals" | "tasks" | "emotion_logs"): Promise<number> {
  const { count, error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * アカウントと全データを削除する。取り消しはできない。
 *
 * `auth.users` の削除には service_role が要るためクライアントからは実行できず、
 * Edge Function（supabase/functions/delete-account）に委ねる。
 * 削除するユーザーは関数側が JWT から判定するため、ここでは何も渡さない。
 */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke("delete-account", { method: "POST" });
  if (error) {
    throw new Error("アカウントの削除に失敗しました。時間をおいて、もう一度お試しください。");
  }
}
