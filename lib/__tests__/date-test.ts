import {
  currentWeekDateRange,
  formatDateLabel,
  formatShortDate,
  relativeDayLabel,
  shiftDateString,
  todayDateString,
} from "../date";

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

describe("shiftDateString", () => {
  test("前日・翌日を返す", () => {
    expect(shiftDateString("2026-07-24", -1)).toBe("2026-07-23");
    expect(shiftDateString("2026-07-24", 1)).toBe("2026-07-25");
  });

  test("月をまたぐ場合も正しく計算する", () => {
    expect(shiftDateString("2026-08-01", -1)).toBe("2026-07-31");
    expect(shiftDateString("2026-07-31", 1)).toBe("2026-08-01");
  });

  test("年をまたぐ場合も正しく計算する", () => {
    expect(shiftDateString("2027-01-01", -1)).toBe("2026-12-31");
  });

  test("うるう年の2月末を正しく扱う", () => {
    expect(shiftDateString("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDateString("2028-03-01", -1)).toBe("2028-02-29");
  });
});

describe("formatDateLabel / formatShortDate", () => {
  test("曜日つきの日本語ラベルを返す", () => {
    expect(formatDateLabel("2026-07-24")).toBe("7月24日（金）");
    expect(formatDateLabel("2026-07-26")).toBe("7月26日（日）");
  });

  test("UTC解釈による日付ずれが起きない（月初）", () => {
    expect(formatDateLabel("2026-07-01")).toBe("7月1日（水）");
    expect(formatShortDate("2026-07-01")).toBe("7/1");
  });

  test("短縮ラベルはゼロ埋めしない", () => {
    expect(formatShortDate("2026-07-24")).toBe("7/24");
  });
});

describe("relativeDayLabel", () => {
  test("当日は「今日」、前日は「昨日」を返す", () => {
    expect(relativeDayLabel("2026-07-26", "2026-07-26")).toBe("今日");
    expect(relativeDayLabel("2026-07-25", "2026-07-26")).toBe("昨日");
  });

  test("2日前より過去はラベルを出さない", () => {
    expect(relativeDayLabel("2026-07-24", "2026-07-26")).toBeNull();
  });

  test("基準日を省略すると今日を基準にする", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 26, 10, 0, 0));
    expect(relativeDayLabel("2026-07-26")).toBe("今日");
    expect(relativeDayLabel("2026-07-25")).toBe("昨日");
    jest.useRealTimers();
  });
});
