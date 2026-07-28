import type { ISODateString } from "../types/database";

/** タイムゾーンを考慮したローカル日付（YYYY-MM-DD）を返す */
export function todayDateString(): ISODateString {
  return toDateString(new Date());
}

function toDateString(d: Date): ISODateString {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "YYYY-MM-DD" をローカルタイムのDateに変換する。
 * `new Date("2026-07-24")` はUTC0時と解釈され、日本時間では前日にずれるため使わない。
 */
function parseDateString(date: ISODateString): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** 指定日から days 日ずらした日付を返す（負数で過去へ） */
export function shiftDateString(date: ISODateString, days: number): ISODateString {
  const d = parseDateString(date);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

/** 画面表示用の日付ラベル（例: "7月24日（金）"） */
export function formatDateLabel(date: ISODateString): string {
  const d = parseDateString(date);
  return `${d.getMonth() + 1}月${d.getDate()}日（${WEEKDAY_LABELS[d.getDay()]}）`;
}

/** 曜日だけのラベル（例: "金"）。グラフの横軸など、幅を取れない場所で使う */
export function weekdayLabel(date: ISODateString): string {
  return WEEKDAY_LABELS[parseDateString(date).getDay()];
}

/** 見出し用の短い日付ラベル（例: "7/24"） */
export function formatShortDate(date: ISODateString): string {
  const d = parseDateString(date);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 今日・昨日・明日の相対ラベルを返す。該当しない日付は null。
 * 「今日から何日離れているか」を意識しすぎないよう、前後1日を超えるとラベルを出さない。
 */
export function relativeDayLabel(
  date: ISODateString,
  today: ISODateString = todayDateString(),
): string | null {
  if (date === today) return "今日";
  if (date === shiftDateString(today, -1)) return "昨日";
  if (date === shiftDateString(today, 1)) return "明日";
  return null;
}

/**
 * 今日を終端とする直近 days 日分の日付を、古い順に並べて返す。
 * 「今日を含めて7日」なので、days=7 なら 6日前〜今日。
 */
export function recentDateStrings(days: number, today: ISODateString = todayDateString()): ISODateString[] {
  return Array.from({ length: days }, (_, i) => shiftDateString(today, i - (days - 1)));
}

/** 今日を含む今週（月曜始まり〜日曜）の日付範囲を返す */
export function currentWeekDateRange(): { start: ISODateString; end: ISODateString } {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=日, 1=月, ... 6=土
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return { start: toDateString(monday), end: toDateString(sunday) };
}
