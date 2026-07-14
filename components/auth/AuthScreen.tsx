import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/supabase/auth-context";
import { colors, radius, shadow, spacing } from "../../lib/theme";

type Mode = "signIn" | "signUp";

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const { error: authError } =
      mode === "signIn" ? await signIn(email, password) : await signUp(email, password);
    setSubmitting(false);
    if (authError) {
      setError(authError);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.logo}>挽回ログ</Text>
        <Text style={styles.tagline}>もう一度、自分のペースで。</Text>
        <Text style={styles.subtitle}>{mode === "signIn" ? "ログイン" : "新規登録"}</Text>

        <TextInput
          style={styles.input}
          placeholder="メールアドレス"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="パスワード"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, (submitting || !email || !password) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting || !email || !password}
        >
          <Text style={styles.submitButtonText}>
            {submitting ? "処理中..." : mode === "signIn" ? "ログイン" : "登録する"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={() => {
            setError(null);
            setMode(mode === "signIn" ? "signUp" : "signIn");
          }}
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
