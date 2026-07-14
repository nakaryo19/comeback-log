import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createGoalWithInitialTasks } from "../../lib/supabase/goals";
import { todayDateString } from "../../lib/date";
import { useAuth } from "../../lib/supabase/auth-context";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [goalTitle, setGoalTitle] = useState("");
  const [taskTitles, setTaskTitles] = useState([""]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateTaskTitle(index: number, value: string) {
    setTaskTitles((prev) => prev.map((t, i) => (i === index ? value : t)));
  }

  function addTaskField() {
    setTaskTitles((prev) => [...prev, ""]);
  }

  async function handleSubmit() {
    if (!user) return;
    const trimmedGoal = goalTitle.trim();
    const trimmedTasks = taskTitles.map((t) => t.trim()).filter((t) => t.length > 0);

    if (!trimmedGoal || trimmedTasks.length === 0) {
      setError("大目標と、今日やることを1つ以上入力してください。");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      await createGoalWithInitialTasks({
        userId: user.id,
        goalTitle: trimmedGoal,
        taskTitles: trimmedTasks,
        date: todayDateString(),
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "登録に失敗しました。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>ようこそ</Text>
        <Text style={styles.subtitle}>まずは目標と、今日やることを教えてください</Text>

        <Text style={styles.label}>大目標</Text>
        <TextInput
          style={styles.input}
          placeholder="例：公務員試験に合格する"
          placeholderTextColor={colors.textMuted}
          value={goalTitle}
          onChangeText={setGoalTitle}
        />

        <Text style={styles.label}>今日やること</Text>
        {taskTitles.map((title, index) => (
          <TextInput
            key={index}
            style={styles.input}
            placeholder={`タスク${index + 1}`}
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={(value) => updateTaskTitle(index, value)}
          />
        ))}

        <TouchableOpacity style={styles.addTaskButton} onPress={addTaskField}>
          <Text style={styles.addTaskButtonText}>+ タスクを追加</Text>
        </TouchableOpacity>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitButtonText}>{submitting ? "登録中..." : "はじめる"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    ...shadow.card,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: colors.textMuted,
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  addTaskButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  addTaskButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
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
    marginTop: spacing.sm,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "600",
  },
});
