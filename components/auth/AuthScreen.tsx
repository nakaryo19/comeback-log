import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/supabase/auth-context";
import { colors, radius, shadow, spacing } from "../../lib/theme";

type Mode = "signIn" | "signUp" | "reset";

const TITLES: Record<Mode, string> = {
  signIn: "ログイン",
  signUp: "新規登録",
  reset: "パスワードの再設定",
};

export function AuthScreen() {
  const { signIn, signUp, sendPasswordReset, recoveryLinkError } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsPassword = mode !== "reset";
  const canSubmit = !submitting && !!email && (!needsPassword || !!password);

  function switchTo(next: Mode) {
    setError(null);
    setNotice(null);
    setMode(next);
  }

  async function handleSubmit() {
    setError(null);
    setNotice(null);
    setSubmitting(true);

    if (mode === "reset") {
      const { error: resetError } = await sendPasswordReset(email);
      setSubmitting(false);
      if (resetError) {
        setError(resetError);
        return;
      }
      // 登録の有無を答えると、アドレスが登録済みかを外部から探れてしまうため、結果に関わらず同じ文面にする
      setNotice(
        "登録されているアドレスであれば、再設定用のリンクを送信しました。メールをご確認ください。",
      );
      return;
    }

    const { error: authError } =
      mode === "signIn" ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (authError) setError(authError);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>挽回ログ</Text>
        <Text style={styles.tagline}>もう一度、自分のペースで。</Text>
        <Text style={styles.subtitle}>{TITLES[mode]}</Text>

        {mode === "reset" && (
          <Text style={styles.description}>
            登録したメールアドレスに、パスワード再設定用のリンクを送ります。
          </Text>
        )}

        {recoveryLinkError && <Text style={styles.error}>{recoveryLinkError}</Text>}

        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        {needsPassword && (
          <TextInput
            style={styles.input}
            placeholder="パスワード"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>
            {submitting
              ? "処理中..."
              : mode === "signIn"
                ? "ログイン"
                : mode === "signUp"
                  ? "登録する"
                  : "再設定リンクを送る"}
          </Text>
        </TouchableOpacity>

        {mode === "signIn" && (
          <TouchableOpacity style={styles.switchButton} onPress={() => switchTo("reset")}>
            <Text style={styles.switchButtonText}>パスワードを忘れた場合</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => switchTo(mode === "signIn" ? "signUp" : "signIn")}
        >
          <Text style={styles.switchButtonText}>
            {mode === "signIn" ? "アカウントを作成する" : "ログイン画面に戻る"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    ...shadow.card,
  },
  logo: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: 13,
    textAlign: "center",
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: "center",
    fontSize: 13,
  },
  notice: {
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  switchButtonText: {
    color: colors.primary,
    fontSize: 14,
  },
});
