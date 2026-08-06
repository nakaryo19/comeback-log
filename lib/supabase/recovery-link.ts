import * as Linking from "expo-linking";
import { Platform } from "react-native";

/**
 * パスワード再設定リンクの戻り先の解釈。
 *
 * Supabase は implicit フローで、成功時もエラー時も **URL のハッシュフラグメント** に
 * 情報を載せて戻してくる。Web ではこれを supabase-js の `detectSessionInUrl` が
 * 自動で処理するが、ネイティブには「今開いている URL」が無いため自動では拾えない。
 * ディープリンクで受け取った URL を、ここで同じ形に解釈する。
 */

/**
 * ネイティブの戻り先パス。
 * **Supabase の Authentication → URL Configuration → Redirect URLs にも
 * 同じ URL を登録しないと、リンクを踏んでもアプリに戻ってこない。**
 */
const RECOVERY_PATH = "auth/recovery";

/**
 * 再設定リンクの戻り先URL。
 * Web は今開いているオリジン、ネイティブは自前のスキーム（`comebacklog://`）。
 */
export function recoveryRedirectTo(): string | undefined {
  if (Platform.OS === "web") {
    return typeof window === "undefined" ? undefined : window.location.origin;
  }
  // createURL は開発ビルド（comebacklog://）と Expo Go（exp://.../--/）の差を吸収する
  return Linking.createURL(RECOVERY_PATH);
}

export type RecoveryLink =
  | { kind: "session"; accessToken: string; refreshToken: string }
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
 * 再設定リンクと無関係な URL（通常のアプリ起動など）では null を返す。
 */
export function parseRecoveryUrl(url: string): RecoveryLink | null {
  const hash = url.split("#")[1];
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  if (params.get("error")) {
    return { kind: "error", message: describeLinkError(params) };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  // type を見ないと、将来メール確認など別種のリンクまで復旧画面へ吸い込んでしまう
  if (params.get("type") !== "recovery" || !accessToken || !refreshToken) return null;

  return { kind: "session", accessToken, refreshToken };
}
