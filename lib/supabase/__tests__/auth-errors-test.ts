import type { AuthError } from "@supabase/supabase-js";
import { describeAuthError } from "../auth-errors";

/** AuthError の最小形。code を持つものと持たないもの、両方を作れるようにする */
function authError(message: string, code?: string): AuthError {
  return { name: "AuthApiError", message, code, status: 400 } as AuthError;
}

test("エラーが無ければ null", () => {
  expect(describeAuthError(null)).toBeNull();
  expect(describeAuthError(undefined)).toBeNull();
});

test("code から日本語の文言に変換する", () => {
  expect(describeAuthError(authError("Invalid login credentials", "invalid_credentials"))).toBe(
    "メールアドレスまたはパスワードが正しくありません。",
  );
});

test("ログイン失敗は、アドレスの登録有無で文言を変えない", () => {
  // 文言を分けると、どのアドレスが登録済みかを外部から探れてしまう
  const unknown = describeAuthError(authError("User not found", "user_not_found"));
  const wrongPassword = describeAuthError(
    authError("Invalid login credentials", "invalid_credentials"),
  );

  expect(unknown).toBe(wrongPassword);
});

test("code が無い場合はメッセージ本文から拾う", () => {
  // 古いサーバーや想定外の経路では code が付かないことがある
  expect(describeAuthError(authError("Invalid login credentials"))).toBe(
    "メールアドレスまたはパスワードが正しくありません。",
  );
});

test("メール送信の失敗を日本語で伝える", () => {
  // B11 の発端。Error sending recovery email が素通しで表示されていた
  expect(describeAuthError(authError("Error sending recovery email"))).toBe(
    "メールを送信できませんでした。しばらくしてから、もう一度お試しください。",
  );
});

test("通信エラーを区別する", () => {
  expect(describeAuthError(authError("Network request failed"))).toBe(
    "通信に失敗しました。電波の良い場所で、もう一度お試しください。",
  );
});

test("対応表に無いエラーでも、英語の原文は返さない", () => {
  // 英語を出さないことがこの関数の目的なので、フォールバックが原文を
  // 素通ししていないことを押さえる。
  // 未対応エラーは開発時に console.warn へ出す実装なので、ここでは黙らせる
  const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
  const result = describeAuthError(authError("Something entirely unexpected happened", "nope"));
  warn.mockRestore();

  expect(result).toBe("処理できませんでした。しばらく時間をおいて、もう一度お試しください。");
  expect(result).not.toContain("Something");
});

test("既知のコードはすべて日本語を返す", () => {
  const codes = [
    "invalid_credentials",
    "email_not_confirmed",
    "user_already_exists",
    "weak_password",
    "same_password",
    "otp_expired",
    "over_email_send_rate_limit",
    "over_request_rate_limit",
  ];

  for (const code of codes) {
    const message = describeAuthError(authError("english text", code));
    expect(message).toBeTruthy();
    expect(message).not.toContain("english");
    // 日本語が含まれていること（ひらがな・カタカナ・漢字のいずれか）
    expect(message).toMatch(/[ぁ-んァ-ヶ一-龠]/);
  }
});
