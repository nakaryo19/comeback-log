import { parseAuthLink } from "../auth-links";

// expo-linking はネイティブモジュールを触るため、テストでは読み込ませない。
// parseAuthLink 自体は Linking に依存しない純粋関数。
jest.mock("expo-linking", () => ({ createURL: (path: string) => `comebacklog:///${path}` }));

const BASE = "comebacklog:///auth/recovery";

describe("parseAuthLink", () => {
  it("再設定リンクからトークンを取り出す", () => {
    const url = `${BASE}#access_token=abc&refresh_token=def&type=recovery&expires_in=3600`;
    expect(parseAuthLink(url)).toEqual({
      kind: "session",
      type: "recovery",
      accessToken: "abc",
      refreshToken: "def",
    });
  });

  it("メール確認リンクは signup として区別する", () => {
    // 種別を落とすと、確認を終えただけの人がパスワード再設定画面に吸い込まれる
    const url = `${BASE}#access_token=abc&refresh_token=def&type=signup`;
    expect(parseAuthLink(url)).toEqual({
      kind: "session",
      type: "signup",
      accessToken: "abc",
      refreshToken: "def",
    });
  });

  it("想定外の type は無視する", () => {
    const url = `${BASE}#access_token=abc&refresh_token=def&type=magiclink`;
    expect(parseAuthLink(url)).toBeNull();
  });

  it("期限切れのリンクは、再送を促す文面のエラーにする", () => {
    const url = `${BASE}#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid`;
    const link = parseAuthLink(url);

    expect(link?.kind).toBe("error");
    // Supabase が返す英語の原文ではなく、日本語の案内を出す
    expect(link).toMatchObject({ message: expect.stringContaining("有効期限") });
  });

  it("error_code が未知でも、説明文をそのまま拾ってエラーにする", () => {
    const url = `${BASE}#error=server_error&error_description=Something+broke`;
    expect(parseAuthLink(url)).toEqual({ kind: "error", message: "Something broke" });
  });

  it("ハッシュの無い通常の起動 URL は無視する", () => {
    expect(parseAuthLink("comebacklog:///")).toBeNull();
  });

  it("トークンが欠けている場合は無視する", () => {
    expect(parseAuthLink(`${BASE}#access_token=abc&type=recovery`)).toBeNull();
  });
});
