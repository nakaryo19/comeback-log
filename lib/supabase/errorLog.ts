import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./client";
import { setErrorSink, type ErrorReport } from "../errorReporter";

/**
 * `lib/errorReporter.ts` の送信先。自前の Supabase の `error_logs` にだけ書く。
 * 外部の監視サービスへは送らない（理由は errorReporter.ts と B5 の判断を参照）。
 */

/** どのバージョンで起きたかが分からないと、直したかどうかを判定できない */
const appVersion = Constants.expoConfig?.version ?? null;

/**
 * 通信が成立しなかったエラーは記録しない。
 *
 * 記録先が Supabase である以上、**通信できないときはこの書き込み自体が失敗する**。
 * 書けたとしても分かるのは「利用者の電波が悪かった」ことだけで、
 * 直せる不具合ではない。無料枠の行を消費するだけなので落とす。
 */
const NETWORK_PATTERNS = ["network request failed", "failed to fetch", "network error", "timeout"];

function isNetworkFailure(message: string): boolean {
  const lowered = message.toLowerCase();
  return NETWORK_PATTERNS.some((pattern) => lowered.includes(pattern));
}

async function write(report: ErrorReport): Promise<void> {
  // ログイン前は RLS（auth.uid() = user_id）を満たせず書けない。
  // 試みるだけ無駄なので、ここで止める
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;

  const { error } = await supabase.from("error_logs").insert({
    context: report.context,
    message: report.message,
    stack: report.stack ?? null,
    app_version: appVersion,
    platform: Platform.OS,
  });

  // 本番では黙る（記録が失敗しても利用者にできることは無い）。
  // ただし開発時は出す。**RLS が拒否しても静かに失敗する**ため、
  // これが無いとポリシーを壊したことに誰も気づけない
  if (error && __DEV__) {
    console.warn("[errorLog] 記録に失敗:", error.message);
  }
}

/** 起動時に1度だけ呼ぶ。以降 `reportError()` の記録がここへ流れる */
export function installErrorLogging(): void {
  setErrorSink((report) => {
    if (isNetworkFailure(report.message)) return;

    // 記録は待たない。エラー処理の途中で画面を止めない
    void write(report).catch(() => {
      // 記録の失敗は握りつぶす。ここで再度エラーを起こしても報告先が無い
    });
  });
}
