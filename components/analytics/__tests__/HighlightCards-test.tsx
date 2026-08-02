import { render, screen } from "@testing-library/react-native";
import { HighlightCards } from "../HighlightCards";
import type { Highlights } from "../../../lib/insights/highlights";
import type { WeeklyStat } from "../../../lib/insights/weeklyStats";
import { EMOTION_TAGS, type EmotionTag } from "../../../lib/insights/tags";

const week: WeeklyStat = {
  start: "2026-06-01",
  end: "2026-06-07",
  totalCount: 10,
  completedCount: 3,
  achievementRate: 30,
  averageScore: 2.4,
  tagCounts: Object.fromEntries(EMOTION_TAGS.map((t) => [t, 0])) as Record<EmotionTag, number>,
};

function highlights(overrides: Partial<Highlights> = {}): Highlights {
  return {
    hasEnoughData: true,
    byWeekStart: new Map(),
    gentleWeek: null,
    patterns: [],
    ...overrides,
  };
}

test("データが4週間分に満たないうちは何も表示しない", async () => {
  await render(
    <HighlightCards
      highlights={highlights({ hasEnoughData: false, gentleWeek: week })}
    />,
  );

  expect(screen.queryByText(/かもしれません/)).toBeNull();
});

test("該当が無ければ何も表示しない", async () => {
  await render(<HighlightCards highlights={highlights()} />);

  expect(screen.queryByText("気づいたこと")).toBeNull();
});

test("下位の週には期間と労いの文言を出す", async () => {
  await render(<HighlightCards highlights={highlights({ gentleWeek: week })} />);

  expect(screen.getByText("この週は、少しペースが落ちていたかもしれません。")).toBeTruthy();
  expect(screen.getByText("6/1 〜 6/7")).toBeTruthy();
});

test("労いの文言に評価的な言葉を使わない", async () => {
  await render(<HighlightCards highlights={highlights({ gentleWeek: week })} />);

  // CLAUDE.md：「不調」「低調」等の評価語を使わない
  expect(screen.queryByText(/不調|低調|悪い|ダメ|できていません/)).toBeNull();
});

test("検出したパターンを並べる", async () => {
  await render(
    <HighlightCards
      highlights={highlights({
        patterns: [
          {
            id: "virtuous",
            weekStart: "2026-06-01",
            message: "調子が良い日は、次の日の勢いにもつながっているようです。",
          },
          {
            id: "cramming",
            weekStart: "2026-06-01",
            message: "タスクを詰め込んだ翌日は、少しペースが落ちる傾向があるようです。",
          },
        ],
      })}
    />,
  );

  expect(screen.getByText("調子が良い日は、次の日の勢いにもつながっているようです。")).toBeTruthy();
  expect(
    screen.getByText("タスクを詰め込んだ翌日は、少しペースが落ちる傾向があるようです。"),
  ).toBeTruthy();
});
