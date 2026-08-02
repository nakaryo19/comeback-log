import { render, screen } from "@testing-library/react-native";
import { WeeklySummaryList } from "../WeeklySummaryList";
import type { WeekHighlight } from "../../../lib/insights/highlights";
import type { WeeklyStat } from "../../../lib/insights/weeklyStats";
import { EMOTION_TAGS, type EmotionTag } from "../../../lib/insights/tags";

function week(start: string, end: string): WeeklyStat {
  return {
    start,
    end,
    totalCount: 10,
    completedCount: 8,
    achievementRate: 80,
    averageScore: 4,
    tagCounts: Object.fromEntries(EMOTION_TAGS.map((t) => [t, 0])) as Record<EmotionTag, number>,
  };
}

const weeks = [week("2026-06-01", "2026-06-07"), week("2026-06-08", "2026-06-14")];

test("ハイライトが無ければバッジを出さない", async () => {
  await render(<WeeklySummaryList weeks={weeks} />);

  expect(screen.queryByText("★ 好調週")).toBeNull();
});

test("好調週にだけバッジを出す", async () => {
  const highlights = new Map<string, WeekHighlight>([["2026-06-08", "good"]]);

  await render(<WeeklySummaryList weeks={weeks} highlights={highlights} />);

  expect(screen.getAllByText("★ 好調週")).toHaveLength(1);
});

test("下位の週には一覧上で何も印を付けない（指摘として読まれないため）", async () => {
  const highlights = new Map<string, WeekHighlight>([["2026-06-01", "gentle"]]);

  await render(<WeeklySummaryList weeks={weeks} highlights={highlights} />);

  expect(screen.queryByText("★ 好調週")).toBeNull();
  expect(screen.queryByText(/不調|低調/)).toBeNull();
});
