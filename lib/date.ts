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
