import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";
import { describeAuthError } from "./auth-errors";
import {
  confirmRedirectTo,
  describeLinkError,
  parseAuthLink,
  recoveryRedirectTo,
} from "./auth-links";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** 再設定リンクから戻ってきた直後だけ true。新パスワードの入力を求める */
  recovering: boolean;
  /** 再設定リンクが無効・期限切れだった場合の理由（リンクを踏んでいなければ null） */
  recoveryLinkError: string | null;
  /**
   * 新規登録。メールアドレス確認が有効なため、成功しても即ログインにはならない。
   * `needsConfirmation` が true の間は、確認メールのリンクを開いてもらう必要がある。
   */
  signUp: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** 確認メールの再送。届かない・見失った場合の唯一の出口 */
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  dismissRecovery: () => void;
}

/** Web で、リンクのエラー情報がハッシュに載って戻ってきていれば拾う */
function readRecoveryLinkError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!params.get("error")) return null;
  return describeLinkError(params);
}

/** トークンやエラーをアドレスバーに残さない（再読み込みで再処理されるのも防ぐ） */
function clearUrlHash(): void {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const [recoveryLinkError, setRecoveryLinkError] = useState<string | null>(null);

  useEffect(() => {
    const linkError = readRecoveryLinkError();
    if (linkError) {
      setRecoveryLinkError(linkError);
      clearUrlHash();
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      // 再設定リンクを踏むと一時的にログイン状態になる。そのままアプリを触らせず、
      // 新しいパスワードを決めてもらうまで復旧画面に留める。
      if (event === "PASSWORD_RECOVERY") {
        setRecovering(true);
        setRecoveryLinkError(null);
        clearUrlHash();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // ネイティブのディープリンク受け口。
  // Web と違い「今開いている URL」が無いため、supabase-js の detectSessionInUrl は使えない。
  // リンクから戻ってきた URL を自前で解釈し、セッションを復元する。
  useEffect(() => {
    if (Platform.OS === "web") return;

    let active = true;

    // 同じリンクを二度処理しない。
    //
    // getInitialURL と url イベントは**同じ URL を両方が返しうる**（アプリが
    // 起動済みのままリンクを踏んだ場合など）。素通しすると setSession が同じ
    // トークンで二重に走る。**リフレッシュトークンは一度しか使えない**ため、
    // 二本目が使用済みのトークンでリフレッシュを試みると、張れたはずの
    // セッションを壊しうる。取りこぼしを防ぐために両方を見る以上、
    // 重複はここで落とす必要がある。
    const handled = new Set<string>();

    async function handleUrl(url: string | null) {
      if (!url || !active) return;
      const link = parseAuthLink(url);
      if (!link) return;
      if (handled.has(url)) return;
      handled.add(url);

      if (link.kind === "error") {
        setRecoveryLinkError(link.message);
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: link.accessToken,
        refresh_token: link.refreshToken,
      });
      if (!active) return;

      if (error) {
        setRecoveryLinkError(
          "リンクの有効期限が切れているか、すでに使用されています。もう一度送信してください。",
        );
        return;
      }

      setRecoveryLinkError(null);

      // メール確認のリンクは、セッションが張れた時点で目的を達している。
      // そのままアプリ本体へ入れる（確認しただけの人にパスワード再設定を求めない）。
      if (link.type === "signup") return;

      // setSession が発火させるのは SIGNED_IN であって PASSWORD_RECOVERY ではない。
      // そのままだと復旧画面を飛ばしてアプリ本体に入ってしまうため、ここで明示的に立てる。
      setRecovering(true);
    }

    // アプリが起動していない状態でリンクを踏んだ場合は getInitialURL、
    // 起動中に踏んだ場合は url イベントで届く。両方を見ないと片方で取りこぼす。
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: confirmRedirectTo() },
    });
    if (error) return { error: describeAuthError(error), needsConfirmation: false };

    // 確認が有効なとき、Supabase はセッションを返さない。
    // 返ってきた場合は確認が無効（自動確認）ということなので、そのままログインさせる。
    //
    // なお **既に登録済みのアドレスでも、ここはエラーにならず成功として返る**。
    // Supabase が意図的にそうしている（エラーを分けると、アドレスが登録済みかを
    // 外部から探れてしまう）。呼び出し側も「送信しました」と同じ案内を出すこと。
    return { error: null, needsConfirmation: data.session === null };
  }

  async function resendConfirmation(email: string) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmRedirectTo() },
    });
    return { error: describeAuthError(error) };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: describeAuthError(error) };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string) {
    // 前のリンクのエラーを残したままだと、送信成功の案内と赤いエラーが同時に出て
    // 「送れたのか失敗したのか」が読み取れなくなる
    setRecoveryLinkError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectTo(),
    });
    return { error: describeAuthError(error) };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return { error: describeAuthError(error) };
  }

  /** 再設定をやめる。リンクで得た一時セッションは破棄してログイン画面へ戻す */
  function dismissRecovery() {
    setRecovering(false);
    setRecoveryLinkError(null);
    supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        recovering,
        recoveryLinkError,
        signUp,
        resendConfirmation,
        signIn,
        signOut,
        sendPasswordReset,
        updatePassword,
        dismissRecovery,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth は AuthProvider の内側で使用してください。");
  }
  return context;
}
