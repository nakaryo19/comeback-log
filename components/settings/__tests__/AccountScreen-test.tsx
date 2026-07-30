import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { AccountScreen } from "../AccountScreen";

const mockSignOut = jest.fn();

jest.mock("../../../lib/supabase/auth-context", () => ({
  useAuth: () => ({ user: { email: "test@example.com" }, signOut: mockSignOut }),
}));

jest.mock("../../../lib/supabase/account", () => ({
  fetchAccountDataSummary: jest.fn(),
  deleteAccount: jest.fn(),
}));

const { fetchAccountDataSummary, deleteAccount } = jest.requireMock(
  "../../../lib/supabase/account",
);

beforeEach(() => {
  jest.clearAllMocks();
  fetchAccountDataSummary.mockResolvedValue({ goals: 2, tasks: 34, emotionLogs: 12 });
  deleteAccount.mockResolvedValue(undefined);
});

/** 確認欄が出るところまで進める */
async function openConfirm() {
  await render(<AccountScreen onBack={jest.fn()} onOpenExport={jest.fn()} />);
  await fireEvent.press(await screen.findByText("アカウントを削除する"));
}

test("削除で失われる件数を具体的に表示する", async () => {
  await render(<AccountScreen onBack={jest.fn()} onOpenExport={jest.fn()} />);

  expect(
    await screen.findByText("大目標 2 件、タスク 34 件、感情の記録 12 件が削除されます。"),
  ).toBeTruthy();
});

test("感情の記録が無いときは、その件数を出さない", async () => {
  fetchAccountDataSummary.mockResolvedValue({ goals: 1, tasks: 3, emotionLogs: 0 });
  await render(<AccountScreen onBack={jest.fn()} onOpenExport={jest.fn()} />);

  expect(await screen.findByText("大目標 1 件、タスク 3 件が削除されます。")).toBeTruthy();
});

test("確認語を入力するまで削除を実行できない", async () => {
  await openConfirm();

  await fireEvent.press(screen.getByText("完全に削除する"));
  expect(deleteAccount).not.toHaveBeenCalled();

  await fireEvent.changeText(screen.getByLabelText("削除の確認"), "けす");
  await fireEvent.press(screen.getByText("完全に削除する"));
  expect(deleteAccount).not.toHaveBeenCalled();
});

test("確認語を入力すると削除し、セッションも破棄する", async () => {
  await openConfirm();

  await fireEvent.changeText(screen.getByLabelText("削除の確認"), "削除");
  await fireEvent.press(screen.getByText("完全に削除する"));

  await waitFor(() => expect(deleteAccount).toHaveBeenCalled());
  await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
});

test("削除に失敗したらエラーを表示し、ログアウトしない", async () => {
  deleteAccount.mockRejectedValue(new Error("アカウントの削除に失敗しました。"));
  await openConfirm();

  await fireEvent.changeText(screen.getByLabelText("削除の確認"), "削除");
  await fireEvent.press(screen.getByText("完全に削除する"));

  expect(await screen.findByText("アカウントの削除に失敗しました。")).toBeTruthy();
  expect(mockSignOut).not.toHaveBeenCalled();
});

test("ログアウトはこの画面に置かない（メニュー側に集約する）", async () => {
  await render(<AccountScreen onBack={jest.fn()} onOpenExport={jest.fn()} />);

  expect(await screen.findByText("アカウント削除")).toBeTruthy();
  expect(screen.queryByText("ログアウト")).toBeNull();
});

test("「やめる」で確認欄を閉じる", async () => {
  await openConfirm();

  await fireEvent.press(screen.getByText("やめる"));

  expect(screen.queryByText("完全に削除する")).toBeNull();
  expect(screen.getByText("アカウントを削除する")).toBeTruthy();
});
