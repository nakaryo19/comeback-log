import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { createGoalWithInitialTasks } from "../../lib/supabase/goals";
import { todayDateString } from "../../lib/date";
import { useAuth } from "../../lib/supabase/auth-context";

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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>ようこそ</Text>
      <Text style={styles.subtitle}>まずは目標と、今日やることを教えてください</Text>

      <Text style={styles.label}>大目標</Text>
      <TextInput
        style={styles.input}
        placeholder="例：公務員試験に合格する"
        value={goalTitle}
        onChangeText={setGoalTitle}
      />

      <Text style={styles.label}>今日やること</Text>
      {taskTitles.map((title, index) => (
        <TextInput
          key={index}
          style={styles.input}
          placeholder={`タスク${index + 1}`}
          value={title}
          onChangeText={(value) => updateTaskTitle(index, value)}
        />
      ))}

      <TouchableOpacity style={styles.addTaskButton} onPress={addTaskField}>
        <Text style={styles.addTaskButtonText}>+ タスクを追加</Text>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitButtonText}>{submitting ? "登録中..." : "はじめる"}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
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
    fontSize: 15,
    textAlign: "center",
    color: "#666",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    fontSize: 16,
  },
  addTaskButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  addTaskButtonText: {
    color: "#2563eb",
    fontSize: 14,
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
    marginTop: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
