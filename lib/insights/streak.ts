/**
 * 継続日数（要件定義書 4-1「進捗の可視化（達成率、連続日数など）」）。
 *
 * Supabase に依存しない純関数として置く。集計の定義が画面ごとにばらつくと、
 * 同じ日について別の数字が出てしまうため（dailyStats.ts と同じ方針）。
 *
 * 表現のトーンについて（CLAUDE.md「不調検出の表現トーンに注意する」）：
 * 継続日数は、放っておくと最も圧をかける指標になる。このアプリの対象は
 * 「一度うまくいかなかったことに、もう一度向き合っている人」であり、
 * 途切れた瞬間に責められる作りにすると、記録そのものをやめる動機になる。
 * そのため次の3点を定義に組み込んでいる。
 *
 * 1. 部分達成の日も数える（下記 isActiveDay）
 * 2. 今日をまだ記録していないだけでは途切れさせない（下記 currentStreak）
 * 3. 途切れているときは 0 ではなく null を返し、UI 側で「－」を出す
 */
import { shiftDateString, todayDateString } from "../date";
import type { ISODateString, TaskStatus } from "../../types/database";

/**
 * さかのぼる上限。これを超える連続は「上限日以上」として扱う。
 *
 * 上限を置かないと、記録が増えるほど毎回のクエリが重くなる。
 * 1年あれば、このアプリが想定する挑戦（受験・資格・再構築）の単位はおおむね収まる。
 */
export const STREAK_LOOKBACK_DAYS = 365;

/**
 * その日を「向き合った日」として数えるタスクのステータス。
 *
 * 完了だけを条件にすると、部分達成しかできなかった日で途切れる。
 * 手をつけたこと自体は途切れていないのに記録上は途切れる、という形になり、
 * しんどい日ほど「どうせ切れるならやらない」方向に働く。部分達成も数える。
 *
 * これに加えて、感情ログの残る日も「記録のあった日」として数える
 * （完了にしたあとステータスを戻した場合など。気持ちを書き残した日を
 * 「何もしなかった日」にはしない）。取得側は `fetchActiveDates` を参照。
 */
export const ACTIVE_TASK_STATUSES: TaskStatus[] = ["done", "partial"];

/**
 * 現在の継続日数を返す。途切れているときは 0 ではなく null。
 *
 * 今日の扱い：今日にまだ記録が無くても、昨日までの連続は維持する。
 * 今日を判定に含めると、朝アプリを開いた時点では必ず 0 から始まることになり、
 * 数字が実態を表さないうえ、一日の始めに毎回リセットを見せることになる。
 * 丸一日空いて初めて途切れる。
 *
 * @param activeDates 記録のあった日の集合（isActiveDay を満たす日）
 */
export function currentStreak(
  activeDates: Set<ISODateString>,
  today: ISODateString = todayDateString(),
): number | null {
  // 今日が未記録なら昨日から数え始める（今日はまだ猶予がある）
  let cursor = activeDates.has(today) ? today : shiftDateString(today, -1);

  let days = 0;
  while (activeDates.has(cursor) && days < STREAK_LOOKBACK_DAYS) {
    days += 1;
    cursor = shiftDateString(cursor, -1);
  }

  return days === 0 ? null : days;
}
