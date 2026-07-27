import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/supabase/auth-context";
import { colors, radius, shadow, spacing } from "../../lib/theme";

/** Supabase 側の既定値に合わせている */
const MIN_PASSWORD_LENGTH = 6;

/**
 * 再設定リンクから戻ってきた直後に出す、新しいパスワードの入力画面。
 * この時点では一時的にログイン状態になっているため、更新するまでアプリ本体には入れない。
 */
export function PasswordRecoveryScreen() {
  const { updatePassword, dismissRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatched = confirmation.length > 0 && password !== confirmation;
  const canSubmit =
    !submitting && password.length >= MIN_PASSWORD_LENGTH && password === confirmation;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);
    if (updateError) setError(updateError);
    // 成功時は recovering が下りて、そのままアプリ本体へ入る
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>挽回ログ</Text>
        <Text style={styles.subtitle}>新しいパスワードの設定</Text>
        <Text style={styles.description}>
          新しいパスワードを決めてください。設定するとそのままログインします。
        </Text>

        <TextInput
          style={styles.input}
          placeholder={`新しいパスワード（${MIN_PASSWORD_LENGTH}文字以上）`}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="確認のためもう一度"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={confirmation}
          onChangeText={setConfirmation}
        />

        {tooShort && (
          <Text style={styles.hint}>{MIN_PASSWORD_LENGTH}文字以上で入力してください。</Text>
        )}
        {mismatched && <Text style={styles.hint}>2つのパスワードが一致していません。</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? "設定中..." : "このパスワードにする"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={dismissRecovery}>
          <Text style={styles.switchButtonText}>やめてログイン画面に戻る</Text>
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
    marginBottom: spacing.lg,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    color: colors.textMuted,
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
  hint: {
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: "center",
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
    textAlign: "center",
    fontSize: 13,
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
