import { currentStreak, STREAK_LOOKBACK_DAYS } from "../streak";
import { shiftDateString } from "../../date";
import type { ISODateString } from "../../../types/database";

const TODAY: ISODateString = "2026-08-09";

/** 今日から days 日前の日付（0 = 今日） */
function daysAgo(days: number): ISODateString {
  return shiftDateString(TODAY, -days);
}

function activeDaysAgo(...offsets: number[]): Set<ISODateString> {
  return new Set(offsets.map(daysAgo));
}

describe("currentStreak", () => {
  it("今日を含めて連続している日数を数える", () => {
    expect(currentStreak(activeDaysAgo(0, 1, 2), TODAY)).toBe(3);
  });

  it("今日がまだ未記録でも、昨日までの連続を維持する", () => {
    // 朝アプリを開いた時点で 0 にリセットされるのを防ぐための扱い
    expect(currentStreak(activeDaysAgo(1, 2, 3), TODAY)).toBe(3);
  });

  it("丸一日空くと途切れる", () => {
    // 昨日も今日も記録が無い（一昨日まで3日続いていた）
    expect(currentStreak(activeDaysAgo(2, 3, 4), TODAY)).toBeNull();
  });

  it("記録が1件も無ければ null を返す（0 ではない）", () => {
    expect(currentStreak(new Set(), TODAY)).toBeNull();
  });

  it("今日だけ記録があれば 1 日", () => {
    expect(currentStreak(activeDaysAgo(0), TODAY)).toBe(1);
  });

  it("昨日だけ記録があれば 1 日", () => {
    expect(currentStreak(activeDaysAgo(1), TODAY)).toBe(1);
  });

  it("連続が途切れた先の古い記録は数えない", () => {
    // 今日・昨日は続いているが、3日前より前は間が空いている
    expect(currentStreak(activeDaysAgo(0, 1, 3, 4, 5), TODAY)).toBe(2);
  });

  it("さかのぼる上限で打ち切る", () => {
    const everyDay = new Set(
      Array.from({ length: STREAK_LOOKBACK_DAYS + 30 }, (_, i) => daysAgo(i)),
    );
    expect(currentStreak(everyDay, TODAY)).toBe(STREAK_LOOKBACK_DAYS);
  });

  it("月をまたいでも連続として数える", () => {
    // 8/1 を今日として、7/30・7/31 から続いている
    expect(currentStreak(new Set(["2026-07-30", "2026-07-31", "2026-08-01"]), "2026-08-01")).toBe(3);
  });
});
