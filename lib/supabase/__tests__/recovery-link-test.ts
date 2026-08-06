import { parseRecoveryUrl } from "../recovery-link";

// expo-linking はネイティブモジュールを触るため、テストでは読み込ませない。
// parseRecoveryUrl 自体は Linking に依存しない純粋関数。
jest.mock("expo-linking", () => ({ createURL: (path: string) => `comebacklog:///${path}` }));

const BASE = "comebacklog:///auth/recovery";

describe("parseRecoveryUrl", () => {
  it("再設定リンクからトークンを取り出す", () => {
    const url = `${BASE}#access_token=abc&refresh_token=def&type=recovery&expires_in=3600`;
    expect(parseRecoveryUrl(url)).toEqual({
      kind: "session",
      accessToken: "abc",
      refreshToken: "def",
    });
  });

  it("期限切れのリンクは、再送を促す文面のエラーにする", () => {
    const url = `${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid`;
    const link = parseRecoveryUrl(url);

    expect(link?.kind).toBe("error");
    // Supabase が返す英語の原文ではなく、日本語の案内を出す
    expect(link).toMatchObject({ message: expect.stringContaining("有効期限") });
  });

  it("error_code が未知でも、説明文をそのまま拾ってエラーにする", () => {
    const url = `${BASE}#error=server_error&error_description=Something+broke`;
    expect(parseRecoveryUrl(url)).toEqual({ kind: "error", message: "Something broke" });
  });

  it("ハッシュの無い通常の起動 URL は無視する", () => {
    expect(parseRecoveryUrl("comebacklog:///")).toBeNull();
  });

  // type を見ないと、メール確認など別種のリンクまで復旧画面へ吸い込んでしまう
  it("recovery 以外の type は無視する", () => {
    const url = `${BASE}#access_token=abc&refresh_token=def&type=signup`;
    expect(parseRecoveryUrl(url)).toBeNull();
  });

  it("トークンが欠けている場合は無視する", () => {
    expect(parseRecoveryUrl(`${BASE}#access_token=abc&type=recovery`)).toBeNull();
  });
});
