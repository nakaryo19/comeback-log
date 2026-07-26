import { fireEvent, render, screen } from "@testing-library/react-native";
import { DateNavigator } from "../DateNavigator";

const TODAY = "2026-07-26"; // 日曜

async function setup(date: string) {
  const onChangeDate = jest.fn();
  await render(<DateNavigator date={date} today={TODAY} onChangeDate={onChangeDate} />);
  return { onChangeDate };
}

describe("<DateNavigator />", () => {
  test("選択中の日付を曜日つきで表示する", async () => {
    await setup("2026-07-24");
    expect(screen.getByText("7月24日（金）")).toBeTruthy();
  });

  test("当日・前日は相対ラベルを添える", async () => {
    await setup(TODAY);
    expect(screen.getByText("今日")).toBeTruthy();
  });

  test("「前日」で1日前の日付を通知する", async () => {
    const { onChangeDate } = await setup(TODAY);
    await fireEvent.press(screen.getByLabelText("前日"));
    expect(onChangeDate).toHaveBeenCalledWith("2026-07-25");
  });

  test("過去日では「翌日」で1日後の日付を通知する", async () => {
    const { onChangeDate } = await setup("2026-07-24");
    await fireEvent.press(screen.getByLabelText("翌日"));
    expect(onChangeDate).toHaveBeenCalledWith("2026-07-25");
  });

  test("今日を表示中は「翌日」を押しても未来へ進まない", async () => {
    const { onChangeDate } = await setup(TODAY);
    await fireEvent.press(screen.getByLabelText("翌日"));
    expect(onChangeDate).not.toHaveBeenCalled();
  });

  test("今日を表示中は「今日へ戻る」を出さない", async () => {
    await setup(TODAY);
    expect(screen.queryByText("今日へ戻る")).toBeNull();
  });

  test("過去日では「今日へ戻る」で今日に戻せる", async () => {
    const { onChangeDate } = await setup("2026-07-20");
    await fireEvent.press(screen.getByText("今日へ戻る"));
    expect(onChangeDate).toHaveBeenCalledWith(TODAY);
  });
});
