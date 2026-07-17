import { currentWeekDateRange, todayDateString } from "../date";

describe("todayDateString", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("ローカル日付を YYYY-MM-DD 形式で返す", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 15, 12, 0, 0)); // 2026-07-15（水）
    expect(todayDateString()).toBe("2026-07-15");
  });

  test("月・日が1桁のときゼロ埋めする", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 5, 9, 0, 0)); // 2026-03-05
    expect(todayDateString()).toBe("2026-03-05");
  });
});

describe("currentWeekDateRange", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test("週の途中（水曜）は同じ週の月曜〜日曜を返す", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 15)); // 2026-07-15（水）
    expect(currentWeekDateRange()).toEqual({ start: "2026-07-13", end: "2026-07-19" });
  });

  test("月曜はその日を開始日とする", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 13)); // 2026-07-13（月）
    expect(currentWeekDateRange()).toEqual({ start: "2026-07-13", end: "2026-07-19" });
  });

  test("日曜は前の月曜〜当日を同じ週として返す", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 19)); // 2026-07-19（日）
    expect(currentWeekDateRange()).toEqual({ start: "2026-07-13", end: "2026-07-19" });
  });

  test("月をまたぐ週も正しく計算する", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 1)); // 2026-08-01（土）
    expect(currentWeekDateRange()).toEqual({ start: "2026-07-27", end: "2026-08-02" });
  });
});
