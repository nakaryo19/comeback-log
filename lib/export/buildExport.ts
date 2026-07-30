import type { UserDataDump } from "../supabase/export";
import type { ISODateString, EmotionLog, Task } from "../../types/database";
import { todayDateString } from "../date";

/**
 * 書き出しの形式。
 *
 * DBのテーブルをそのまま並べるのではなく、大目標→中目標→タスク→感情の記録の
 * 入れ子にする。書き出したファイルを本人が開いて読めることが目的であり、
 * ID を突き合わせないと意味が分からない形では、控えとして役に立たないため。
 */
export const EXPORT_FORMAT_VERSION = 1;

export type ExportedEmotionLog = {
  score: number;
  tag: string | null;
  free_text: string | null;
  recorded_at: string;
};

export type ExportedTask = {
  title: string;
  status: Task["status"];
  date: ISODateString;
  emotion_log: ExportedEmotionLog | null;
};

export type ExportedSubGoal = {
  title: string;
  is_provisional: boolean;
  achieved_at: string | null;
  tasks: ExportedTask[];
};

export type ExportedGoal = {
  title: string;
  achieved_at: string | null;
  created_at: string;
  sub_goals: ExportedSubGoal[];
};

export type ExportPayload = {
  format_version: number;
  app: string;
  exported_at: string;
  counts: { goals: number; sub_goals: number; tasks: number; emotion_logs: number };
  goals: ExportedGoal[];
};

export function buildExportPayload(dump: UserDataDump, now: Date = new Date()): ExportPayload {
  const logsByTaskId = new Map<string, EmotionLog>(
    dump.emotionLogs.map((log) => [log.task_id, log]),
  );

  const tasksBySubGoalId = new Map<string, Task[]>();
  for (const task of dump.tasks) {
    const list = tasksBySubGoalId.get(task.sub_goal_id);
    if (list) {
      list.push(task);
    } else {
      tasksBySubGoalId.set(task.sub_goal_id, [task]);
    }
  }

  const goals = dump.goals.map((goal) => ({
    title: goal.title,
    achieved_at: goal.achieved_at,
    created_at: goal.created_at,
    sub_goals: dump.subGoals
      .filter((subGoal) => subGoal.goal_id === goal.id)
      .map((subGoal) => ({
        title: subGoal.title,
        is_provisional: subGoal.is_provisional,
        achieved_at: subGoal.achieved_at,
        // 日付順に並べる。記録を時系列で読み返せることが控えの価値そのものなので、
        // 登録順（created_at）ではなく実施日で並べる
        tasks: [...(tasksBySubGoalId.get(subGoal.id) ?? [])]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((task) => {
            const log = logsByTaskId.get(task.id);
            return {
              title: task.title,
              status: task.status,
              date: task.date,
              emotion_log: log
                ? {
                    score: log.score,
                    tag: log.tag,
                    free_text: log.free_text,
                    recorded_at: log.created_at,
                  }
                : null,
            };
          }),
      })),
  }));

  return {
    format_version: EXPORT_FORMAT_VERSION,
    app: "comeback-log",
    exported_at: now.toISOString(),
    counts: {
      goals: dump.goals.length,
      sub_goals: dump.subGoals.length,
      tasks: dump.tasks.length,
      emotion_logs: dump.emotionLogs.length,
    },
    goals,
  };
}

/** 書き出すファイル名。日付を入れて、複数回書き出しても上書きにならないようにする */
export function exportFileName(
  extension: "csv" | "json",
  today: ISODateString = todayDateString(),
): string {
  return `comeback-log-${today}.${extension}`;
}
