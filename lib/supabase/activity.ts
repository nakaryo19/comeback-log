import { supabase } from "./client";
import { ACTIVE_TASK_STATUSES } from "../insights/streak";
import type { ISODateString } from "../../types/database";

/**
 * 期間内で「記録のあった日」を取得する（継続日数の算出用）。
 *
 * 日付だけを引く。継続日数はタスク1件ごとの中身を必要としないのに、
 * 1年分のタスク行をすべて取ると、ホーム画面がタスクを1つ完了するたびに
 * 数千行を運ぶことになる。
 *
 * 「記録のあった日」の定義は `ACTIVE_TASK_STATUSES` のコメントを参照。
 * 完了・部分達成のタスクがある日に加え、感情ログの残る日も数えるため、
 * 2本のクエリの和集合を取る。
 *
 * 感情ログ側は日付だけを取り出す（`tasks!inner(date)`）。スコアもタグも
 * 自由記述も、この用途には要らないため運ばない
 * （CLAUDE.md「感情ログのプライバシーを最優先する」）。
 */
export async function fetchActiveDates(
  start: ISODateString,
  end: ISODateString,
): Promise<Set<ISODateString>> {
  const [tasks, logs] = await Promise.all([
    supabase
      .from("tasks")
      .select("date")
      .in("status", ACTIVE_TASK_STATUSES)
      .gte("date", start)
      .lte("date", end),
    supabase
      .from("emotion_logs")
      .select("tasks!inner(date)")
      .gte("tasks.date", start)
      .lte("tasks.date", end),
  ]);

  if (tasks.error) throw tasks.error;
  if (logs.error) throw logs.error;

  const dates = new Set<ISODateString>();
  for (const row of tasks.data ?? []) {
    dates.add(row.date);
  }

  // 埋め込み（tasks!inner）の戻り値は生成された型に現れないため、ここだけ手で型を当てる。
  // 1:1 の関連でも配列で返る場合があるので、どちらの形でも拾う。
  type EmbeddedTask = { date: ISODateString };
  const logRows = (logs.data ?? []) as unknown as { tasks: EmbeddedTask | EmbeddedTask[] | null }[];
  for (const row of logRows) {
    if (!row.tasks) continue;
    for (const task of Array.isArray(row.tasks) ? row.tasks : [row.tasks]) {
      dates.add(task.date);
    }
  }
  return dates;
}
