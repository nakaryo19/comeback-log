/**
 * データ操作の例外を、利用者に見せる日本語の文言に変換する。
 *
 * 直す前は各画面が `e instanceof Error ? e.message : "タスクの追加に失敗しました。"`
 * と書いていた。**三項演算子が逆**で、せっかく用意した日本語は `Error` 以外が
 * 投げられたときにしか使われず、実際には PostgREST の英語がそのまま画面に出ていた。
 *
 * 認証（`auth-errors.ts`）と違い、**エラーコードで文言を分けない。**
 * PostgREST のコード（`23505`, `PGRST116` …）は利用者にとって意味を持たず、
 * 分岐を増やしても読み手の行動は変わらない。分けるのは
 * **「通信できなかった」のか「操作が失敗した」のか**だけにする。
 * 前者は電波を変えれば直り、後者は直らない。利用者が取れる手が違う。
 *
 * 何の操作に失敗したかは呼び出し側が `fallback` で渡す。画面ごとに
 * 「タスクの追加」「大目標の削除」と具体的に書けるのは呼び出し側だけなので、
 * ここで一律の文言に潰さない。
 */

/**
 * 利用者にそのまま見せてよい文言を持つ例外。
 *
 * 自前のコードが投げる例外の一部は、**汎用文より具体的な日本語**を持っている
 * （「この端末では共有機能を利用できないため…」など）。これらは再試行しても
 * 直らない条件を伝えていて、汎用文に潰すと利用者が取れる手を失う。
 * 一方で外から来た例外の本文は信用できない。両者を型で分ける。
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

const NETWORK = "通信に失敗しました。電波の良い場所で、もう一度お試しください。";

/** 通信そのものが成立しなかったことを示す文言。処理系ごとに表記が違う */
const NETWORK_PATTERNS = [
  "network request failed",
  "failed to fetch",
  "network error",
  "timeout",
  "timed out",
];

/**
 * 例外を日本語の文言にする。
 *
 * @param fallback この操作が失敗したことを表す日本語（例：「タスクの追加に失敗しました。」）
 *
 * **例外の原文は決して返さない。** PostgREST や fetch の英語をそのまま画面に出さない
 * ことが目的だからである（`auth-errors.ts` と同じ方針）。
 * 追跡のため、開発時のみコンソールへ出す。
 */
export function describeDataError(error: unknown, fallback: string): string {
  // 自前で書いた日本語は、汎用文より具体的なので優先する
  if (error instanceof UserFacingError) return error.message;

  const raw = error instanceof Error ? error.message : String(error);
  const lowered = raw.toLowerCase();

  if (NETWORK_PATTERNS.some((pattern) => lowered.includes(pattern))) {
    return NETWORK;
  }

  if (__DEV__) {
    console.warn("[data]", fallback, "/ 原因:", raw);
  }
  return fallback;
}
