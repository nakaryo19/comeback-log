import * as Linking from "expo-linking";
import { Platform } from "react-native";

/**
 * メールで届く認証リンク（パスワード再設定・メールアドレス確認）の戻り先と、その解釈。
 *
 * Supabase は implicit フローで、成功時もエラー時も **URL のハッシュフラグメント** に
 * 情報を載せて戻してくる。Web ではこれを supabase-js の `detectSessionInUrl` が
 * 自動で処理するが、ネイティブには「今開いている URL」が無いため自動では拾えない。
 * ディープリンクで受け取った URL を、ここで同じ形に解釈する。
 *
 * 2種類のリンクは **戻り先パスも用途も違うが、ハッシュの形は同じ**。
 * 区別は `type`（`recovery` / `signup`）だけなので、必ずこれを見る。
 * 見落とすと、メール確認を終えただけの人が「新しいパスワードを決めてください」の
 * 画面に吸い込まれる。
 */

/**
 * ネイティブの戻り先パス。
 * **Supabase の Authentication → URL Configuration → Redirect URLs にも
 * 同じ URL を登録しないと、リンクを踏んでもアプリに戻ってこない。**
 */
const RECOVERY_PATH = "auth/recovery";
const CONFIRM_PATH = "auth/confirm";

/** リンクの種別。Supabase がハッシュに載せる `type` の値に対応する */
export type AuthLinkType = "recovery" | "signup";

function redirectTo(path: string): string | undefined {
  if (Platform.OS === "web") {
    return typeof window === "undefined" ? undefined : window.location.origin;
  }
  // createURL は開発ビルド（comebacklog://）と Expo Go（exp://.../--/）の差を吸収する
  return Linking.createURL(path);
}

/**
 * 再設定リンクの戻り先URL。
 * Web は今開いているオリジン、ネイティブは自前のスキーム（`comebacklog://`）。
 */
export function recoveryRedirectTo(): string | undefined {
  return redirectTo(RECOVERY_PATH);
}

/** メールアドレス確認リンクの戻り先URL */
export function confirmRedirectTo(): string | undefined {
  return redirectTo(CONFIRM_PATH);
}

export type AuthLink =
  | { kind: "session"; type: AuthLinkType; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string };

/**
 * リンクが無効・期限切れの場合、Supabase は成功時と同じくハッシュに情報を載せて戻す。
 * 黙って握りつぶすと「押しても何も起きない」画面になるため、理由を拾って画面に出す。
 */
export function describeLinkError(params: URLSearchParams): string {
  return params.get("error_code") === "otp_expired"
    ? "リンクの有効期限が切れているか、すでに使用されています。もう一度送信してください。"
    : (params.get("error_description") ?? "リンクが無効です。もう一度送信してください。");
}

/**
 * ディープリンクで受け取った URL を解釈する。
 * 認証リンクと無関係な URL（通常のアプリ起動など）では null を返す。
 */
export function parseAuthLink(url: string): AuthLink | null {
  const hash = url.split("#")[1];
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  if (params.get("error")) {
    return { kind: "error", message: describeLinkError(params) };
  }

  const type = params.get("type");
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if ((type !== "recovery" && type !== "signup") || !accessToken || !refreshToken) return null;

  return { kind: "session", type, accessToken, refreshToken };
}
