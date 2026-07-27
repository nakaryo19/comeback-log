import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./client";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** 再設定リンクから戻ってきた直後だけ true。新パスワードの入力を求める */
  recovering: boolean;
  /** 再設定リンクが無効・期限切れだった場合の理由（リンクを踏んでいなければ null） */
  recoveryLinkError: string | null;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  dismissRecovery: () => void;
}

/**
 * 再設定リンクの戻り先URL。Webでは今開いているオリジンをそのまま使う。
 * Supabase の Authentication → URL Configuration で許可されている必要がある。
 */
function recoveryRedirectTo(): string | undefined {
  if (Platform.OS !== "web" || typeof window === "undefined") return undefined;
  return window.location.origin;
}

/**
 * リンクが無効・期限切れの場合、Supabase は成功時と同じくハッシュに情報を載せて戻す。
 * 黙って握りつぶすと「押しても何も起きない」画面になるため、理由を拾って画面に出す。
 */
function readRecoveryLinkError(): string | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!params.get("error")) return null;

  return params.get("error_code") === "otp_expired"
    ? "リンクの有効期限が切れているか、すでに使用されています。もう一度送信してください。"
    : (params.get("error_description") ?? "リンクが無効です。もう一度送信してください。");
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

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectTo(),
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(password: string) {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setRecovering(false);
    return { error: error?.message ?? null };
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
