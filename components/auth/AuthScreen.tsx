import { useState } from "react";
import { Linking, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/supabase/auth-context";
import { EMAIL_NOT_CONFIRMED } from "../../lib/supabase/auth-errors";
import { legalLinks } from "../../lib/legalLinks";
import { colors, hitSlop, radius, shadow, spacing } from "../../lib/theme";

/** `confirm` は入力欄を持たず、確認メールを開いてもらうための案内だけを出す */
type Mode = "signIn" | "signUp" | "reset" | "confirm";

const TITLES: Record<Mode, string> = {
  signIn: "ログイン",
  signUp: "新規登録",
  reset: "パスワードの再設定",
  confirm: "確認メールを送りました",
};

const SUBMIT_LABELS: Record<Mode, string> = {
  signIn: "ログイン",
  signUp: "登録する",
  reset: "再設定リンクを送る",
  confirm: "確認メールを再送する",
};

const links = legalLinks();

export function AuthScreen() {
  const { signIn, signUp, resendConfirmation, sendPasswordReset, recoveryLinkError } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const needsPassword = mode === "signIn" || mode === "signUp";
  const showsInputs = mode !== "confirm";
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

    if (mode === "confirm") {
      const { error: resendError } = await resendConfirmation(email);
      setSubmitting(false);
      if (resendError) {
        setError(resendError);
        return;
      }
      setNotice("確認メールを再送しました。");
      return;
    }

    if (mode === "reset") {
      const { error: resetError } = await sendPasswordReset(email);
      setSubmitting(false);
      if (resetError) {
        setError(resetError);
        return;
      }
      // 登録の有無を答えると、アドレスが登録済みかを外部から探れてしまうため、結果に関わらず同じ文面にする。
      // 迷惑メールへの言及は保険ではなく実務上必須：独自ドメインを持たない構成のため
      // 送信ドメイン認証（SPF / DKIM）が張れず、振り分けられる可能性が現実にある
      setNotice(
        "登録されているアドレスであれば、再設定用のリンクを送信しました。" +
          "数分待っても届かない場合は、迷惑メールフォルダもご確認ください。",
      );
      return;
    }

    if (mode === "signUp") {
      const { error: signUpError, needsConfirmation } = await signUp(email, password);
      setSubmitting(false);
      if (signUpError) {
        setError(signUpError);
        return;
      }
      // 確認が要らない設定なら、この時点で既にログイン済み。画面は自然に切り替わる
      if (needsConfirmation) switchTo("confirm");
      return;
    }

    const { error: authError } = await signIn(email, password);
    setSubmitting(false);
    if (!authError) return;

    // 未確認のままログインしようとした人には、エラーを出すだけでは出口がない。
    // 再送できる画面へ送る
    if (authError === EMAIL_NOT_CONFIRMED) {
      switchTo("confirm");
      setNotice(EMAIL_NOT_CONFIRMED);
      return;
    }
    setError(authError);
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

        {mode === "confirm" && (
          // 迷惑メールへの言及は保険ではなく実務上必須：独自ドメインを持たない構成のため
          // 送信ドメイン認証（SPF / DKIM）が張れず、振り分けられる可能性が現実にある
          <Text style={styles.description}>
            {email} 宛にリンクを送りました。{"\n"}
            リンクを開くと登録が完了します。{"\n"}
            数分待っても届かない場合は、迷惑メールフォルダもご確認ください。
          </Text>
        )}

        {recoveryLinkError && <Text style={styles.error}>{recoveryLinkError}</Text>}

        {showsInputs && (
          <TextInput
            style={styles.input}
            placeholder="メールアドレス"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        )}
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
            {submitting ? "処理中..." : SUBMIT_LABELS[mode]}
          </Text>
        </TouchableOpacity>

        {mode === "signIn" && (
          <TouchableOpacity hitSlop={hitSlop} style={styles.switchButton} onPress={() => switchTo("reset")}>
            <Text style={styles.switchButtonText}>パスワードを忘れた場合</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          hitSlop={hitSlop}
          style={styles.switchButton}
          onPress={() => switchTo(mode === "signIn" ? "signUp" : "signIn")}
        >
          <Text style={styles.switchButtonText}>
            {mode === "signIn" ? "アカウントを作成する" : "ログイン画面に戻る"}
          </Text>
        </TouchableOpacity>

        {/* 登録の直前に、何に同意することになるのかを読める場所を置く。
            登録後の設定画面だけに置くと、同意した後にしか読めないことになる */}
        {mode === "signUp" && links.length > 0 && (
          // Text の入れ子にして1つの文として折り返す。View を並べると
          // 単語単位で折れず、狭い端末で「と」だけが行頭に落ちる
          <Text style={styles.legalNotice}>
            登録すると、
            {links.map((link, index) => (
              <Text key={link.url}>
                {index > 0 && "と"}
                <Text style={styles.legalLink} onPress={() => Linking.openURL(link.url)}>
                  {link.label}
                </Text>
              </Text>
            ))}
            に同意したものとみなされます。
          </Text>
        )}
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
  legalNotice: {
    marginTop: spacing.lg,
    fontSize: 11,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: "center",
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: "underline",
  },
  switchButtonText: {
    color: colors.primary,
    fontSize: 14,
  },
});
