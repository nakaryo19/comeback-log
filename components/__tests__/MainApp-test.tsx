import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

/**
 * 目標の取得に失敗したときに、行き止まりを作らないことを確かめる。
 *
 * 直す前は `loadGoals` に try/catch が無く、失敗すると `goals` が null のまま
 * 「読み込み中...」で永久に止まっていた。その分岐は ☰ メニューを描画しないため、
 * **ログアウトも再試行も画面移動もできなくなる**。App Store の審査で
 * 「アプリが動作しない」と判定されうる形なので、退避手段の有無をテストで固定する。
 */

const mockFetchGoalTree = jest.fn();
const mockSignOut = jest.fn();

// 実クライアントは環境変数を要求するため、テストから import してはならない（CLAUDE.md）
jest.mock("../../lib/supabase/goals", () => ({
  fetchGoalTree: (...args: unknown[]) => mockFetchGoalTree(...args),
  selectableSubGoals: () => [],
  findDefaultSubGoalId: () => null,
}));

// user は**同一の参照を返し続ける**必要がある。MainApp の loadGoals は
// useCallback([user]) なので、描画のたびに別オブジェクトを返すと依存が変わり続け、
// 取得→失敗→再描画→取得…の無限ループになる（本物の user はセッションの state なので安定している）
const mockAuthUser = { id: "user-1", email: "someone@example.com" };

jest.mock("../../lib/supabase/auth-context", () => ({
  useAuth: () => ({ user: mockAuthUser, signOut: mockSignOut }),
}));

// 失敗の分岐だけを見たいので、成功時に開く画面は空にしておく
jest.mock("../home/HomeScreen", () => ({ HomeScreen: () => null }));
jest.mock("../goals/OnboardingScreen", () => ({ OnboardingScreen: () => null }));
jest.mock("../goals/GoalManagementScreen", () => ({ GoalManagementScreen: () => null }));
jest.mock("../analytics/AnalyticsScreen", () => ({ AnalyticsScreen: () => null }));
jest.mock("../settings/AccountScreen", () => ({ AccountScreen: () => null }));
jest.mock("../settings/DataExportScreen", () => ({ DataExportScreen: () => null }));
jest.mock("../settings/AboutScreen", () => ({ AboutScreen: () => null }));

import { MainApp } from "../MainApp";

let consoleWarn: jest.SpyInstance;

beforeEach(() => {
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  mockFetchGoalTree.mockReset();
  mockSignOut.mockReset();
});

afterEach(() => {
  consoleWarn.mockRestore();
});

test("取得に失敗したら、読み込み中のまま止めずに理由を出す", async () => {
  mockFetchGoalTree.mockRejectedValue({ code: "PGRST301", message: "JWT expired" });

  await render(<MainApp />);

  await waitFor(() => expect(screen.getByText("目標の読み込みに失敗しました。")).toBeTruthy());
  // 永久に「読み込み中...」を出し続けたのが元の不具合
  expect(screen.queryByText("読み込み中...")).toBeNull();
});

test("失敗しても、通信の文言は原文ではなく日本語で出す", async () => {
  // PostgREST や fetch の英語をそのまま画面に出さない（data-errors.ts の方針）
  mockFetchGoalTree.mockRejectedValue(new Error("Network request failed"));

  await render(<MainApp />);

  await waitFor(() =>
    expect(
      screen.getByText("通信に失敗しました。電波の良い場所で、もう一度お試しください。"),
    ).toBeTruthy(),
  );
  expect(screen.queryByText(/Network request failed/)).toBeNull();
});

test("再試行できる。通信が戻れば復帰する", async () => {
  mockFetchGoalTree.mockRejectedValueOnce(new Error("Network request failed")).mockResolvedValueOnce([]);

  await render(<MainApp />);
  await waitFor(() => expect(screen.getByText("再試行")).toBeTruthy());

  await fireEvent.press(screen.getByText("再試行"));

  await waitFor(() => expect(screen.queryByText("再試行")).toBeNull());
  expect(mockFetchGoalTree).toHaveBeenCalledTimes(2);
});

test("再試行しても直らない場合の逃げ道としてログアウトを置く", async () => {
  // 再試行だけだと、取得が恒久的に失敗する利用者はアプリから出られなくなる
  mockFetchGoalTree.mockRejectedValue(new Error("Network request failed"));

  await render(<MainApp />);
  await waitFor(() => expect(screen.getByText("ログアウト")).toBeTruthy());

  await fireEvent.press(screen.getByText("ログアウト"));

  expect(mockSignOut).toHaveBeenCalled();
});
