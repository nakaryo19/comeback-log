/**
 * 本番で起きたエラーを運用者が見られるようにする（リリース計画 B5）。
 *
 * **このファイルは送信先を知らない。** 送信の実体（Supabase への書き込み）は
 * 起動時に `setErrorSink()` で差し込む。理由は2つある。
 *
 * 1. 呼び出し元のひとつが `lib/supabase/data-errors.ts` で、ここが Supabase
 *    クライアントを import すると、環境変数を必要とする実クライアントが
 *    テストから読み込まれてしまう（CLAUDE.md のテスト規約に反する）
 * 2. 「どこへ送るか」は方針であって、エラーの取り扱いそのものとは別の関心事。
 *    将来 B の枠を出るとき（外部サービスの検討など）に、差し替える場所が1箇所で済む
 *
 * **送り先は自前の Supabase だけ。外部の監視サービスへは送らない。**
 * 例外の文脈には感情ログの自由記述が混ざりうるため（CLAUDE.md）。
 */

export interface ErrorReport {
  /** どこで起きたか。画面名や操作名（"ErrorBoundary" / "タスクの取得" 等） */
  context: string;
  message: string;
  stack?: string;
}

type ErrorSink = (report: ErrorReport) => void;

let sink: ErrorSink | null = null;

/** 送信の実体を差し込む。アプリ起動時に1度だけ呼ぶ */
export function setErrorSink(next: ErrorSink | null): void {
  sink = next;
}

/**
 * 長すぎる本文を打ち切る。
 *
 * 例外メッセージには、DB が値をそのまま含めてくることがある
 * （一意制約違反など）。全文を残す価値は無く、行が肥大するだけなので
 * 頭だけ残す。**利用者が書いた本文を意図的に載せてはならない。**
 */
function truncate(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit)}…`;
}

/**
 * エラーを記録する。
 *
 * **決して throw しない。** 記録に失敗したことで画面が壊れたら本末転倒で、
 * しかも壊れるのは「既に何かが失敗している」場面である。
 */
/**
 * 例外を、記録して意味のある1行にする。
 *
 * **`String(error)` に頼ってはいけない。** supabase-js が返す PostgREST のエラーは
 * `Error` のインスタンスではなく `{ message, details, hint, code }` の素のオブジェクトで、
 * `String()` すると `"[object Object]"` になる。実際これで、2026-08-28 までに記録された
 * DB 由来のエラーはすべて本文を失っていた（原因調査が一度も成立しなかった）。
 *
 * `code` は残す。PostgREST のコードは利用者には見せないが（data-errors.ts）、
 * **運用者にとっては原因の当たりを付ける唯一の手がかり**になる。
 */
export function describeThrown(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }

  if (typeof error === "object" && error !== null) {
    const shape = error as { message?: unknown; code?: unknown; details?: unknown };
    const parts = [shape.message, shape.details]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join(" / ");
    const code = typeof shape.code === "string" && shape.code.length > 0 ? `[${shape.code}] ` : "";

    // message も details も無い形は想定外。JSON にして中身ごと残す
    if (!parts) return { message: `${code}${safeJson(error)}` };
    return { message: `${code}${parts}` };
  }

  return { message: String(error) };
}

/** 循環参照を含む値でも記録を諦めない。記録処理は決して throw させない */
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function reportError(context: string, error: unknown): void {
  const { message, stack } = describeThrown(error);

  if (__DEV__) {
    console.warn(`[error] ${context}:`, message);
  }

  if (!sink) return;
  try {
    sink({
      context: truncate(context, 100),
      message: truncate(message, 500),
      stack: stack ? truncate(stack, 2000) : undefined,
    });
  } catch {
    // 送信の実体側が投げても、呼び出し元には影響させない
  }
}
