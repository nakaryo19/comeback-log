import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { GoalWithSubGoals } from "../../lib/supabase/goals";
import { findDefaultSubGoalId } from "../../lib/supabase/goals";
import { createTask, fetchTasksForDate, updateTaskStatus } from "../../lib/supabase/tasks";
import { todayDateString } from "../../lib/date";
import type { Task, TaskStatus } from "../../types/database";
import { WeeklySummary } from "./WeeklySummary";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未完了",
  partial: "部分達成",
  done: "完了",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "partial", "done"];

export function HomeScreen({
  goals,
  onOpenGoalManagement,
}: {
  goals: GoalWithSubGoals[];
  onOpenGoalManagement: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = todayDateString();
  const defaultSubGoalId = findDefaultSubGoalId(goals);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      setTasks(await fetchTasksForDate(today));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await updateTaskStatus(taskId, status);
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
      loadTasks();
    }
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title || !defaultSubGoalId) return;
    try {
      await createTask({ subGoalId: defaultSubGoalId, title, date: today });
      setNewTaskTitle("");
      loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの追加に失敗しました。");
    }
  }

  const achievementRate =
    tasks.length === 0
      ? null
      : Math.round((tasks.filter((t) => t.status === "done").length / tasks.length) * 100);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>今日のタスク</Text>
        <TouchableOpacity onPress={onOpenGoalManagement}>
          <Text style={styles.navLink}>目標管理</Text>
        </TouchableOpacity>
      </View>

      <WeeklySummary />

      {achievementRate !== null && (
        <Text style={styles.summary}>今日の達成率：{achievementRate}%</Text>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      {loading ? (
        <Text style={styles.empty}>読み込み中...</Text>
      ) : tasks.length === 0 ? (
        <Text style={styles.empty}>今日のタスクはまだありません</Text>
      ) : (
        tasks.map((task) => (
          <View key={task.id} style={styles.taskCard}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <View style={styles.statusRow}>
              {STATUS_ORDER.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusButton,
                    task.status === status && styles.statusButtonActive,
                  ]}
                  onPress={() => handleStatusChange(task.id, status)}
                >
                  <Text
                    style={[
                      styles.statusButtonText,
                      task.status === status && styles.statusButtonTextActive,
                    ]}
                  >
                    {STATUS_LABEL[status]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}

      <View style={styles.addTaskRow}>
        <TextInput
          style={styles.addTaskInput}
          placeholder="今日のタスクを追加"
          value={newTaskTitle}
          onChangeText={setNewTaskTitle}
          onSubmitEditing={handleAddTask}
        />
        <TouchableOpacity style={styles.addTaskButton} onPress={handleAddTask}>
          <Text style={styles.addTaskButtonText}>追加</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  navLink: {
    color: "#2563eb",
    fontSize: 14,
  },
  summary: {
    fontSize: 14,
    color: "#666",
    marginBottom: 16,
  },
  error: {
    color: "#b91c1c",
    marginBottom: 12,
  },
  empty: {
    color: "#888",
    marginTop: 24,
    textAlign: "center",
  },
  taskCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  taskTitle: {
    fontSize: 16,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusButtonActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  statusButtonText: {
    fontSize: 13,
    color: "#333",
  },
  statusButtonTextActive: {
    color: "#fff",
  },
  addTaskRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
  },
  addTaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  addTaskButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  addTaskButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
