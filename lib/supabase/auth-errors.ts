import type { AuthError } from "@supabase/supabase-js";

/**
 * 認証エラーを日本語の文言に変換する。
 *
 * Supabase が返すのは英語のメッセージで、そのまま画面に出すと
 * 日本語話者には何が起きたか分からない（`Error sending recovery email` が
 * 利用者に見えていた）。
 *
 * 判定は **`code` を主、メッセージ本文を従** とする。メッセージはサーバー側の
 * 変更で文言が変わるが、`code` は安定している。ただし古いサーバーや
 * 想定外の経路では `code` が付かないことがあるため、本文一致を保険に残す。
 */

/** アドレスの登録有無を推測させないため、ログイン失敗はすべて同じ文言にする */
const INVALID_CREDENTIALS = "メールアドレスまたはパスワードが正しくありません。";

const GENERIC = "処理できませんでした。しばらく時間をおいて、もう一度お試しください。";

const NETWORK = "通信に失敗しました。電波の良い場所で、もう一度お試しください。";

const BY_CODE: Record<string, string> = {
  // ── ログイン ──
  invalid_credentials: INVALID_CREDENTIALS,
  // 存在しないユーザーでも invalid_credentials が返るのが既定だが、
  // 設定によっては user_not_found が返る。文言を分けると探索の手がかりになる
  user_not_found: INVALID_CREDENTIALS,
  email_not_confirmed: "メールアドレスの確認が済んでいません。確認メールのリンクを開いてください。",
  user_banned: "このアカウントは現在ご利用いただけません。",

  // ── 新規登録 ──
  user_already_exists: "このメールアドレスは既に登録されています。ログインをお試しください。",
  email_exists: "このメールアドレスは既に登録されています。ログインをお試しください。",
  signup_disabled: "現在、新規登録を受け付けていません。",
  email_provider_disabled: "現在、メールアドレスでの登録を受け付けていません。",

  // ── パスワード ──
  weak_password: "パスワードは6文字以上にしてください。",
  same_password: "現在と同じパスワードは設定できません。別のパスワードを入力してください。",

  // ── アドレスの形式・宛先 ──
  email_address_invalid: "メールアドレスの形式が正しくありません。",
  validation_failed: "入力内容を確認してください。",
  // 送信基盤（Brevo）が宛先を拒否した場合。設定不備のことが多い
  email_address_not_authorized:
    "このメールアドレスには送信できませんでした。別のアドレスでお試しください。",

  // ── 再設定リンク ──
  otp_expired:
    "リンクの有効期限が切れているか、すでに使用されています。もう一度送信してください。",
  session_expired: "しばらく操作がなかったため、もう一度ログインが必要です。",
  bad_jwt: "しばらく操作がなかったため、もう一度ログインが必要です。",
  reauthentication_needed: "もう一度ログインしてから、お試しください。",

  // ── レート制限 ──
  over_email_send_rate_limit:
    "メールの送信回数が上限に達しました。しばらく時間をおいてから、もう一度お試しください。",
  over_request_rate_limit:
    "短時間に操作が集中しています。しばらく時間をおいてから、もう一度お試しください。",
};

/**
 * `code` が付かない場合の保険。**部分一致**で見る。
 * ここに頼るのは例外的な経路なので、網羅は狙わない。
 */
const BY_MESSAGE: [pattern: string, message: string][] = [
  ["invalid login credentials", INVALID_CREDENTIALS],
  ["email not confirmed", BY_CODE.email_not_confirmed],
  ["user already registered", BY_CODE.user_already_exists],
  ["password should be", BY_CODE.weak_password],
  ["rate limit", BY_CODE.over_request_rate_limit],
  // カスタム SMTP の設定不備・送信基盤側の拒否。利用者には原因を出せないが、
  // 「送れなかった」ことだけは伝える必要がある
  ["error sending", "メールを送信できませんでした。しばらくしてから、もう一度お試しください。"],
  ["network request failed", NETWORK],
  ["failed to fetch", NETWORK],
];

/**
 * エラーを日本語の文言にする。エラーが無ければ null。
 *
 * 対応表にない場合は汎用の文言を返す。**英語の原文は決して返さない** ——
 * それを避けることがこの関数の目的だからである。
 * 代わりに開発時のみコンソールへ出し、追跡できるようにする。
 */
export function describeAuthError(error: AuthError | null | undefined): string | null {
  if (!error) return null;

  const code = error.code;
  if (code && BY_CODE[code]) return BY_CODE[code];

  const lowered = error.message.toLowerCase();
  const matched = BY_MESSAGE.find(([pattern]) => lowered.includes(pattern));
  if (matched) return matched[1];

  if (__DEV__) {
    console.warn("[auth] 未対応のエラー:", error.code, error.message);
  }
  return GENERIC;
}
