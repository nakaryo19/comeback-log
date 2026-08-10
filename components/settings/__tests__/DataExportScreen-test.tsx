import { fireEvent, render, screen } from "@testing-library/react-native";
import { DataExportScreen } from "../DataExportScreen";

jest.mock("../../../lib/supabase/export", () => ({ fetchAllUserData: jest.fn() }));
jest.mock("../../../lib/export/saveFile", () => ({ saveTextFile: jest.fn() }));

const { fetchAllUserData } = jest.requireMock("../../../lib/supabase/export");
const { saveTextFile } = jest.requireMock("../../../lib/export/saveFile");

const dump = {
  goals: [
    {
      id: "g1",
      user_id: "u1",
      title: "簿記2級に合格する",
      achieved_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  ],
  subGoals: [
    {
      id: "s1",
      goal_id: "g1",
      title: "商業簿記を終わらせる",
      is_provisional: false,
      achieved_at: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  ],
  tasks: [
    {
      id: "t1",
      sub_goal_id: "s1",
      title: "第3問を解く",
      status: "done",
      date: "2026-07-10",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    },
  ],
  emotionLogs: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  fetchAllUserData.mockResolvedValue(dump);
  saveTextFile.mockResolvedValue("saved");
});

test("CSVで保存すると、表として読める中身を渡す", async () => {
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  const [fileName, content, format] = saveTextFile.mock.calls[0];
  expect(fileName).toMatch(/^comeback-log-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(content).toContain("簿記2級に合格する");
  expect(content).toContain("第3問を解く");
  expect(format).toBe("csv");
});

test("JSONで保存すると、階層を保った中身を渡す", async () => {
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("JSONで保存"));

  const [fileName, content, format] = saveTextFile.mock.calls[0];
  expect(fileName).toMatch(/\.json$/);
  expect(JSON.parse(content).goals[0].sub_goals[0].tasks[0].title).toBe("第3問を解く");
  expect(format).toBe("json");
});

test("Web で保存できたらファイル名を画面に出す", async () => {
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(await screen.findByText(/を保存しました。$/)).toBeTruthy();
});

test("共有シート経由のときは、保存できたと言い切らない", async () => {
  // 共有シートは保存をやめた場合も同じように閉じるため、結果を断定できない
  saveTextFile.mockResolvedValue("shared");
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(await screen.findByText(/選んだ保存先をご確認ください。$/)).toBeTruthy();
  expect(screen.queryByText(/を保存しました。$/)).toBeNull();
});

test("保存に失敗したら理由を表示する", async () => {
  saveTextFile.mockRejectedValue(
    new Error("この端末では共有機能を利用できないため、書き出しできませんでした。"),
  );
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(
    await screen.findByText("この端末では共有機能を利用できないため、書き出しできませんでした。"),
  ).toBeTruthy();
});

test("取得に失敗したら理由を表示し、保存はしない", async () => {
  fetchAllUserData.mockRejectedValue(new Error("データの取得に失敗しました。"));
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(await screen.findByText("データの取得に失敗しました。")).toBeTruthy();
  expect(saveTextFile).not.toHaveBeenCalled();
});
