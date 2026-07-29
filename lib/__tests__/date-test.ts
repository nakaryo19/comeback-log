import {
  currentMonthString,
  currentWeekDateRange,
  formatDateLabel,
  formatMonthLabel,
  formatShortDate,
  monthDateStrings,
  recentDateStrings,
  recentWeekStarts,
  shiftMonthString,
  weekStartString,
  weekdayLabel,
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
  test("当日は「今日」、前日は「昨日」、翌日は「明日」を返す", () => {
    expect(relativeDayLabel("2026-07-26", "2026-07-26")).toBe("今日");
    expect(relativeDayLabel("2026-07-25", "2026-07-26")).toBe("昨日");
    expect(relativeDayLabel("2026-07-27", "2026-07-26")).toBe("明日");
  });

  test("前後1日を超えるとラベルを出さない", () => {
    expect(relativeDayLabel("2026-07-24", "2026-07-26")).toBeNull();
    expect(relativeDayLabel("2026-07-28", "2026-07-26")).toBeNull();
  });

  test("基準日を省略すると今日を基準にする", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 26, 10, 0, 0));
    expect(relativeDayLabel("2026-07-26")).toBe("今日");
    expect(relativeDayLabel("2026-07-25")).toBe("昨日");
    jest.useRealTimers();
  });
});

describe("recentDateStrings", () => {
  test("今日を終端とする直近N日を、古い順に返す", () => {
    expect(recentDateStrings(7, "2026-07-26")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
    ]);
  });

  test("月をまたいでも正しく遡る", () => {
    expect(recentDateStrings(3, "2026-08-02")).toEqual([
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  test("基準日を省略すると今日を終端にする", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 6, 26, 10, 0, 0));
    const days = recentDateStrings(7);
    expect(days).toHaveLength(7);
    expect(days[6]).toBe("2026-07-26");
    jest.useRealTimers();
  });
});

describe("weekStartString", () => {
  test("週の途中は同じ週の月曜を返す", () => {
    expect(weekStartString("2026-07-15")).toBe("2026-07-13"); // 水
  });

  test("月曜はその日を返し、日曜は前の月曜を返す", () => {
    expect(weekStartString("2026-07-13")).toBe("2026-07-13");
    expect(weekStartString("2026-07-19")).toBe("2026-07-13");
  });
});

describe("recentWeekStarts", () => {
  test("今週を終端とする直近N週の月曜を、古い順に返す", () => {
    expect(recentWeekStarts(3, "2026-07-15")).toEqual([
      "2026-06-29",
      "2026-07-06",
      "2026-07-13",
    ]);
  });

  test("日曜を基準にしても、その日を含む週が終端になる", () => {
    expect(recentWeekStarts(2, "2026-07-19")).toEqual(["2026-07-06", "2026-07-13"]);
  });
});

describe("monthDateStrings", () => {
  test("月末までの日付をゼロ埋めで返す", () => {
    const july = monthDateStrings("2026-07");
    expect(july).toHaveLength(31);
    expect(july[0]).toBe("2026-07-01");
    expect(july[30]).toBe("2026-07-31");
  });

  test("30日の月・平年の2月・うるう年の2月をそれぞれ正しく扱う", () => {
    expect(monthDateStrings("2026-06")).toHaveLength(30);
    expect(monthDateStrings("2026-02")).toHaveLength(28);
    expect(monthDateStrings("2028-02")).toHaveLength(29);
  });
});

describe("shiftMonthString / currentMonthString / formatMonthLabel", () => {
  test("前後の月を返し、年をまたいでも正しく計算する", () => {
    expect(shiftMonthString("2026-07", -1)).toBe("2026-06");
    expect(shiftMonthString("2026-07", 1)).toBe("2026-08");
    expect(shiftMonthString("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthString("2026-12", 1)).toBe("2027-01");
  });

  test("今日の属する年月を返す", () => {
    expect(currentMonthString("2026-07-15")).toBe("2026-07");
  });

  test("見出し用のラベルはゼロ埋めしない", () => {
    expect(formatMonthLabel("2026-07")).toBe("2026年7月");
  });
});

describe("weekdayLabel", () => {
  test("曜日1文字を返す", () => {
    expect(weekdayLabel("2026-07-26")).toBe("日");
    expect(weekdayLabel("2026-07-27")).toBe("月");
    expect(weekdayLabel("2026-07-28")).toBe("火");
  });

  test("UTC解釈による前日へのズレが起きない", () => {
    // new Date("2026-07-26") はUTC0時と解釈され、日本時間では前日（土）になってしまう
    expect(weekdayLabel("2026-07-26")).not.toBe("土");
  });
});
