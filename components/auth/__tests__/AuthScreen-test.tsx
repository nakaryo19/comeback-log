import { fireEvent, render, screen } from "@testing-library/react-native";
import { AuthScreen } from "../AuthScreen";
import { useAuth } from "../../../lib/supabase/auth-context";

jest.mock("../../../lib/supabase/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const signIn = jest.fn();
const signUp = jest.fn();
const sendPasswordReset = jest.fn();
const resendConfirmation = jest.fn();

function stubAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  mockUseAuth.mockReturnValue({
    session: null,
    user: null,
    loading: false,
    recovering: false,
    recoveryLinkError: null,
    signIn,
    signUp,
    resendConfirmation,
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
  signUp.mockResolvedValue({ error: null, needsConfirmation: true });
  sendPasswordReset.mockResolvedValue({ error: null });
  resendConfirmation.mockResolvedValue({ error: null });
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
    // 独自ドメインを持たない構成では SPF / DKIM を張れず、実際に振り分けられうる。
    // 案内が消えると「届かない＝復旧できない」と受け取られる
    expect(screen.getByText(/迷惑メールフォルダ/)).toBeTruthy();
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

describe("<AuthScreen /> メールアドレスの確認", () => {
  async function signUpWith(email: string) {
    await render(<AuthScreen />);
    await fireEvent.press(screen.getByText("アカウントを作成する"));
    await fireEvent.changeText(screen.getByPlaceholderText("メールアドレス"), email);
    await fireEvent.changeText(screen.getByPlaceholderText("パスワード"), "password123");
    await fireEvent.press(screen.getByText("登録する"));
  }

  test("登録しただけでは完了と言わず、確認メールの案内を出す", async () => {
    await signUpWith("a@example.com");

    expect(signUp).toHaveBeenCalledWith("a@example.com", "password123");
    expect(screen.getByText("確認メールを送りました")).toBeTruthy();
    // どのアドレス宛に送ったかを出す。打ち間違いに気づける唯一の場所
    expect(screen.getByText(/a@example\.com 宛にリンクを送りました/)).toBeTruthy();
    expect(screen.getByText(/迷惑メールフォルダ/)).toBeTruthy();
  });

  test("案内画面から確認メールを再送できる", async () => {
    await signUpWith("a@example.com");

    await fireEvent.press(screen.getByText("確認メールを再送する"));

    expect(resendConfirmation).toHaveBeenCalledWith("a@example.com");
    expect(screen.getByText("確認メールを再送しました。")).toBeTruthy();
  });

  test("案内画面では入力欄を出さない（もう入力するものがない）", async () => {
    await signUpWith("a@example.com");

    expect(screen.queryByPlaceholderText("メールアドレス")).toBeNull();
    expect(screen.queryByPlaceholderText("パスワード")).toBeNull();
  });

  test("確認が要らない設定なら、案内を挟まずそのまま進む", async () => {
    // 自動確認が有効な環境では signUp がセッションを返す。
    // ここで案内画面を出すと、届かないメールを待たせることになる
    signUp.mockResolvedValue({ error: null, needsConfirmation: false });
    await signUpWith("a@example.com");

    expect(screen.queryByText("確認メールを送りました")).toBeNull();
  });

  test("未確認のままログインした人を、再送できる画面へ送る", async () => {
    // エラーを出すだけだと、確認メールを見失った人に出口がない
    signIn.mockResolvedValue({
      error: "メールアドレスの確認が済んでいません。確認メールのリンクを開いてください。",
    });
    await render(<AuthScreen />);
    await fireEvent.changeText(screen.getByPlaceholderText("メールアドレス"), "a@example.com");
    await fireEvent.changeText(screen.getByPlaceholderText("パスワード"), "password123");
    // 「ログイン」は見出しとボタンの両方にある。後に描かれる方がボタン
    await fireEvent.press(screen.getAllByText("ログイン")[1]);

    expect(screen.getByText("確認メールを送りました")).toBeTruthy();
    expect(screen.getByText(/確認が済んでいません/)).toBeTruthy();
    expect(screen.getByText("確認メールを再送する")).toBeTruthy();
  });

  test("再送に失敗したら日本語の理由を出す", async () => {
    resendConfirmation.mockResolvedValue({
      error: "メールの送信回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。",
    });
    await signUpWith("a@example.com");

    await fireEvent.press(screen.getByText("確認メールを再送する"));

    expect(screen.getByText(/送信回数が上限/)).toBeTruthy();
  });
});
