/**
 * 日単位の集計（可視化ダッシュボードの土台）。
 *
 * Supabase に依存しない純関数に切り出してある。散布図・ヒートマップ・週次リストは
 * どれも「日ごとのタスク完了数と感情スコア」から派生するため、集計の定義が
 * 画面ごとにばらつくと、同じ日について別の数字が出てしまう。定義はここ1箇所に置く。
 *
 * ルールベースのみで完結させる（CLAUDE.md：外部AI APIを呼ばない）。
 */
import type { EmotionScore, ISODateString, Task, UUID } from "../../types/database";

export type DailyStat = {
  date: ISODateString;
  /** その日に完了（done）したタスク数。部分達成は数えない */
  completedCount: number;
  /** その日の感情スコアの平均。感情ログが1件も無い日は null（0ではない） */
  averageScore: number | null;
};

/**
 * 指定した日付ごとに、完了タスク数と平均感情スコアを集計する。
 *
 * 感情ログが無い日を 0 ではなく null にしているのは、「記録しなかった日」と
 * 「気分が最低だった日」を同じ点として描かないため。スコアは 1〜5 で 0 は存在しない。
 */
export function buildDailyStats(
  dates: ISODateString[],
  tasks: Task[],
  scoresByTaskId: Map<UUID, EmotionScore>,
): DailyStat[] {
  const completed = new Map<ISODateString, number>();
  const scoreSums = new Map<ISODateString, { sum: number; count: number }>();

  for (const task of tasks) {
    if (task.status === "done") {
      completed.set(task.date, (completed.get(task.date) ?? 0) + 1);
    }
    // 感情ログは完了タスクにのみ付く導線だが、ステータスを後から戻しても
    // ログは残る。記録された気持ちを集計から落とさないよう、status では絞らない。
    const score = scoresByTaskId.get(task.id);
    if (score !== undefined) {
      const acc = scoreSums.get(task.date) ?? { sum: 0, count: 0 };
      scoreSums.set(task.date, { sum: acc.sum + score, count: acc.count + 1 });
    }
  }

  return dates.map((date) => {
    const acc = scoreSums.get(date);
    return {
      date,
      completedCount: completed.get(date) ?? 0,
      averageScore: acc ? Math.round((acc.sum / acc.count) * 10) / 10 : null,
    };
  });
}
