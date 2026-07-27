import { fireEvent, render, screen } from "@testing-library/react-native";
import { PasswordRecoveryScreen } from "../PasswordRecoveryScreen";
import { useAuth } from "../../../lib/supabase/auth-context";

jest.mock("../../../lib/supabase/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const updatePassword = jest.fn();
const dismissRecovery = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  updatePassword.mockResolvedValue({ error: null });
  mockUseAuth.mockReturnValue({
    session: null,
    user: null,
    loading: false,
    recovering: true,
    recoveryLinkError: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    sendPasswordReset: jest.fn(),
    updatePassword,
    dismissRecovery,
  } as ReturnType<typeof useAuth>);
});

async function fill(password: string, confirmation: string) {
  await fireEvent.changeText(
    screen.getByPlaceholderText("新しいパスワード（6文字以上）"),
    password,
  );
  await fireEvent.changeText(screen.getByPlaceholderText("確認のためもう一度"), confirmation);
}

describe("<PasswordRecoveryScreen />", () => {
  test("一致した6文字以上のパスワードを設定できる", async () => {
    await render(<PasswordRecoveryScreen />);
    await fill("newpass123", "newpass123");

    await fireEvent.press(screen.getByText("このパスワードにする"));

    expect(updatePassword).toHaveBeenCalledWith("newpass123");
  });

  test("2つが一致しなければ設定しない", async () => {
    await render(<PasswordRecoveryScreen />);
    await fill("newpass123", "newpass124");

    expect(screen.getByText("2つのパスワードが一致していません。")).toBeTruthy();

    await fireEvent.press(screen.getByText("このパスワードにする"));
    expect(updatePassword).not.toHaveBeenCalled();
  });

  test("6文字未満なら設定しない", async () => {
    await render(<PasswordRecoveryScreen />);
    await fill("abc", "abc");

    expect(screen.getByText("6文字以上で入力してください。")).toBeTruthy();

    await fireEvent.press(screen.getByText("このパスワードにする"));
    expect(updatePassword).not.toHaveBeenCalled();
  });

  test("更新に失敗したらエラーを表示する", async () => {
    updatePassword.mockResolvedValue({ error: "New password should be different" });
    await render(<PasswordRecoveryScreen />);
    await fill("newpass123", "newpass123");

    await fireEvent.press(screen.getByText("このパスワードにする"));

    expect(screen.getByText("New password should be different")).toBeTruthy();
  });

  test("やめるとログイン画面に戻す", async () => {
    await render(<PasswordRecoveryScreen />);

    await fireEvent.press(screen.getByText("やめてログイン画面に戻る"));

    expect(dismissRecovery).toHaveBeenCalled();
  });
});
