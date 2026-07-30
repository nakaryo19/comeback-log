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
});

test("CSVで保存すると、表として読める中身を渡す", async () => {
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  const [fileName, content, mimeType] = saveTextFile.mock.calls[0];
  expect(fileName).toMatch(/^comeback-log-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(content).toContain("簿記2級に合格する");
  expect(content).toContain("第3問を解く");
  expect(mimeType).toContain("text/csv");
});

test("JSONで保存すると、階層を保った中身を渡す", async () => {
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("JSONで保存"));

  const [fileName, content, mimeType] = saveTextFile.mock.calls[0];
  expect(fileName).toMatch(/\.json$/);
  expect(JSON.parse(content).goals[0].sub_goals[0].tasks[0].title).toBe("第3問を解く");
  expect(mimeType).toBe("application/json");
});

test("保存できたらファイル名を画面に出す", async () => {
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(await screen.findByText(/を保存しました。$/)).toBeTruthy();
});

test("保存に失敗したら理由を表示する", async () => {
  saveTextFile.mockImplementation(() => {
    throw new Error("この端末ではまだ書き出しに対応していません。");
  });
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(await screen.findByText("この端末ではまだ書き出しに対応していません。")).toBeTruthy();
});

test("取得に失敗したら理由を表示し、保存はしない", async () => {
  fetchAllUserData.mockRejectedValue(new Error("データの取得に失敗しました。"));
  await render(<DataExportScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("CSVで保存"));

  expect(await screen.findByText("データの取得に失敗しました。")).toBeTruthy();
  expect(saveTextFile).not.toHaveBeenCalled();
});
