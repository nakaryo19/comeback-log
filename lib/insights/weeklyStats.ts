/**
 * 週単位の集計（詳細分析画面の週次サマリーリスト・タグ推移グラフの土台）。
 *
 * dailyStats と同じく Supabase に依存しない純関数として切り出す。
 * ルールベースのみで完結させる（CLAUDE.md：外部AI APIを呼ばない）。
 */
import { shiftDateString, todayDateString } from "../date";
import type { EmotionEntry } from "../supabase/emotionLogs";
import type { ISODateString, Task, UUID } from "../../types/database";
import { EMOTION_TAGS, isEmotionTag, type EmotionTag } from "./tags";

export type WeeklyStat = {
  /** 週の開始日（月曜） */
  start: ISODateString;
  /** 週の終了日（日曜） */
  end: ISODateString;
  /** 達成率の分母になったタスク数（未来日の予定は含まない） */
  totalCount: number;
  completedCount: number;
  /** 達成率（%）。対象タスクが1件も無い週は null */
  achievementRate: number | null;
  /** 平均感情スコア。感情ログが1件も無い週は null */
  averageScore: number | null;
  /** タグごとの記録数。タグ未選択のログは数えない */
  tagCounts: Record<EmotionTag, number>;
};

function emptyTagCounts(): Record<EmotionTag, number> {
  return Object.fromEntries(EMOTION_TAGS.map((tag) => [tag, 0])) as Record<EmotionTag, number>;
}

/**
 * 週ごとに達成率・平均感情スコア・タグ件数を集計する。
 *
 * まだ来ていない日の予定は達成率の分母に入れない（WeeklySummary と同じ規則）。
 * 先の予定を登録した瞬間に達成率が下がると、記録すること自体が罰になってしまうため。
 */
export function buildWeeklyStats(
  weekStarts: ISODateString[],
  tasks: Task[],
  entriesByTaskId: Map<UUID, EmotionEntry>,
  today: ISODateString = todayDateString(),
): WeeklyStat[] {
  return weekStarts.map((start) => {
    const end = shiftDateString(start, 6);
    const inWeek = tasks.filter((t) => t.date >= start && t.date <= end);

    const scored = inWeek.filter((t) => t.date <= today);
    const completedCount = scored.filter((t) => t.status === "done").length;

    const tagCounts = emptyTagCounts();
    let scoreSum = 0;
    let scoreCount = 0;
    for (const task of inWeek) {
      const entry = entriesByTaskId.get(task.id);
      if (!entry) continue;
      scoreSum += entry.score;
      scoreCount += 1;
      if (isEmotionTag(entry.tag)) tagCounts[entry.tag] += 1;
    }

    return {
      start,
      end,
      totalCount: scored.length,
      completedCount,
      achievementRate:
        scored.length === 0 ? null : Math.round((completedCount / scored.length) * 100),
      averageScore: scoreCount === 0 ? null : Math.round((scoreSum / scoreCount) * 10) / 10,
      tagCounts,
    };
  });
}
