import type { ISODateString } from "../types/database";

/** タイムゾーンを考慮したローカル日付（YYYY-MM-DD）を返す */
export function todayDateString(): ISODateString {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
