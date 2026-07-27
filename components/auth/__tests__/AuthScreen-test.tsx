import { fireEvent, render, screen } from "@testing-library/react-native";
import { AuthScreen } from "../AuthScreen";
import { useAuth } from "../../../lib/supabase/auth-context";

jest.mock("../../../lib/supabase/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const signIn = jest.fn();
const signUp = jest.fn();
const sendPasswordReset = jest.fn();

function stubAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    session: null,
    user: null,
    loading: false,
    recovering: false,
    recoveryLinkError: null,
    signIn,
    signUp,
    signOut: jest.fn(),
    sendPasswordReset,
    updatePassword: jest.fn(),
    dismissRecovery: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  jest.clearAllMocks();
  signIn.mockResolvedValue({ error: null });
  signUp.mockResolvedValue({ error: null });
  sendPasswordReset.mockResolvedValue({ error: null });
  stubAuth();
});

describe("<AuthScreen /> パスワード再設定", () => {
  test("「パスワードを忘れた場合」から再設定モードに入れる", async () => {
    await render(<AuthScreen />);

    await fireEvent.press(screen.getByText("パスワードを忘れた場合"));

    expect(screen.getByText("パスワードの再設定")).toBeTruthy();
    // 再設定はメールアドレスだけで送るため、パスワード欄は出さない
    expect(screen.queryByPlaceholderText("パスワード")).toBeNull();
  });

  test("メールアドレスだけで再設定リンクを送れる", async () => {
    await render(<AuthScreen />);
    await fireEvent.press(screen.getByText("パスワードを忘れた場合"));

    await fireEvent.changeText(screen.getByPlaceholderText("メールアドレス"), "a@example.com");
    await fireEvent.press(screen.getByText("再設定リンクを送る"));

    expect(sendPasswordReset).toHaveBeenCalledWith("a@example.com");
  });

  test("送信後は、登録の有無を明かさない文面を出す", async () => {
    await render(<AuthScreen />);
    await fireEvent.press(screen.getByText("パスワードを忘れた場合"));
    await fireEvent.changeText(screen.getByPlaceholderText("メールアドレス"), "a@example.com");
    await fireEvent.press(screen.getByText("再設定リンクを送る"));

    expect(screen.getByText(/登録されているアドレスであれば/)).toBeTruthy();
  });

  test("リンクが無効だった場合は理由を表示する", async () => {
    stubAuth({ recoveryLinkError: "リンクの有効期限が切れています。" });
    await render(<AuthScreen />);

    expect(screen.getByText("リンクの有効期限が切れています。")).toBeTruthy();
  });

  test("再設定モードでは「パスワードを忘れた場合」を重ねて出さない", async () => {
    await render(<AuthScreen />);
    await fireEvent.press(screen.getByText("パスワードを忘れた場合"));

    expect(screen.queryByText("パスワードを忘れた場合")).toBeNull();
    expect(screen.getByText("ログイン画面に戻る")).toBeTruthy();
  });

  test("ログイン画面に戻ると通知が消える", async () => {
    await render(<AuthScreen />);
    await fireEvent.press(screen.getByText("パスワードを忘れた場合"));
    await fireEvent.changeText(screen.getByPlaceholderText("メールアドレス"), "a@example.com");
    await fireEvent.press(screen.getByText("再設定リンクを送る"));
    await fireEvent.press(screen.getByText("ログイン画面に戻る"));

    expect(screen.queryByText(/登録されているアドレスであれば/)).toBeNull();
    // ログインモードに戻っているので、パスワード欄が復活する
    expect(screen.getByPlaceholderText("パスワード")).toBeTruthy();
  });
});
