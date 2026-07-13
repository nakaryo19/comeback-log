import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAuth } from "../../lib/supabase/auth-context";

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
    <View style={styles.container}>
      <Text style={styles.title}>挽回ログ</Text>
      <Text style={styles.subtitle}>
        {mode === "signIn" ? "ログイン" : "新規登録"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="メールアドレス"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="パスワード"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={styles.submitButton}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    color: "#666",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 12,
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  switchButton: {
    marginTop: 16,
    alignItems: "center",
  },
  switchButtonText: {
    color: "#2563eb",
    fontSize: 14,
  },
});
