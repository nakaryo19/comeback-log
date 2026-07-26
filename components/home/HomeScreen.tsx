import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { GoalWithSubGoals } from "../../lib/supabase/goals";
import { findDefaultSubGoalId } from "../../lib/supabase/goals";
import {
  createTask,
  deleteTask,
  fetchTasksForDate,
  updateTaskStatus,
  updateTaskTitle,
} from "../../lib/supabase/tasks";
import { fetchLoggedTaskIds } from "../../lib/supabase/emotionLogs";
import { formatShortDate, todayDateString } from "../../lib/date";
import type { ISODateString, Task, TaskStatus } from "../../types/database";
import { WeeklySummary } from "./WeeklySummary";
import { EmotionLogForm } from "./EmotionLogForm";
import { DateNavigator } from "./DateNavigator";
import { colors, radius, shadow, spacing } from "../../lib/theme";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未完了",
  partial: "部分達成",
  done: "完了",
};

const STATUS_ORDER: TaskStatus[] = ["todo", "partial", "done"];

const STATUS_ACTIVE_COLOR: Record<TaskStatus, string> = {
  todo: colors.neutral,
  partial: colors.warning,
  done: colors.success,
};

export function HomeScreen({
  goals,
  onOpenGoalManagement,
}: {
  goals: GoalWithSubGoals[];
  onOpenGoalManagement: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loggedTaskIds, setLoggedTaskIds] = useState<Set<string>>(new Set());
  const [emotionPromptTaskId, setEmotionPromptTaskId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const today = todayDateString();
  const [selectedDate, setSelectedDate] = useState<ISODateString>(today);
  const isToday = selectedDate === today;
  const dateLabel = isToday ? "今日" : formatShortDate(selectedDate);
  const defaultSubGoalId = findDefaultSubGoalId(goals);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedTasks = await fetchTasksForDate(selectedDate);
      setTasks(fetchedTasks);
      setLoggedTaskIds(await fetchLoggedTaskIds(fetchedTasks.map((t) => t.id)));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  function handleChangeDate(date: ISODateString) {
    setEmotionPromptTaskId(null);
    setEditingTaskId(null);
    setDeletingTaskId(null);
    setSelectedDate(date);
  }

  function startEditing(task: Task) {
    setDeletingTaskId(null);
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  }

  async function handleSaveTitle(task: Task) {
    const title = editingTitle.trim();
    if (!title || title === task.title) {
      setEditingTaskId(null);
      return;
    }
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, title } : t)));
    setEditingTaskId(null);
    try {
      await updateTaskTitle(task.id, title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの更新に失敗しました。");
      loadTasks();
    }
  }

  async function handleDeleteTask(taskId: string) {
    setDeletingTaskId(null);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    if (emotionPromptTaskId === taskId) setEmotionPromptTaskId(null);
    try {
      await deleteTask(taskId);
      setSummaryRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの削除に失敗しました。");
      loadTasks();
    }
  }

  async function handleStatusChange(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    try {
      await updateTaskStatus(taskId, status);
      setSummaryRefreshKey((k) => k + 1);
      if (status === "done" && !loggedTaskIds.has(taskId)) {
        setEmotionPromptTaskId(taskId);
      } else if (emotionPromptTaskId === taskId) {
        setEmotionPromptTaskId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "更新に失敗しました。");
      loadTasks();
    }
  }

  async function handleAddTask() {
    const title = newTaskTitle.trim();
    if (!title || !defaultSubGoalId) return;
    try {
      await createTask({ subGoalId: defaultSubGoalId, title, date: selectedDate });
      setNewTaskTitle("");
      loadTasks();
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの追加に失敗しました。");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{isToday ? "今日のログ" : "過去のログ"}</Text>
            <Text style={styles.title}>{dateLabel}のタスク</Text>
          </View>
          <TouchableOpacity style={styles.navLinkButton} onPress={onOpenGoalManagement}>
            <Text style={styles.navLink}>目標管理</Text>
          </TouchableOpacity>
        </View>

        <DateNavigator date={selectedDate} today={today} onChangeDate={handleChangeDate} />

        <WeeklySummary refreshKey={summaryRefreshKey} />

        {error && <Text style={styles.error}>{error}</Text>}

        {loading ? (
          <Text style={styles.empty}>読み込み中...</Text>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>{dateLabel}のタスクはまだありません</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              {editingTaskId === task.id ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.editInput}
                    value={editingTitle}
                    onChangeText={setEditingTitle}
                    onSubmitEditing={() => handleSaveTitle(task)}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={() => handleSaveTitle(task)}
                  >
                    <Text style={styles.editSaveButtonText}>保存</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingTaskId(null)}>
                    <Text style={styles.subtleAction}>やめる</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.taskTitleRow}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  {loggedTaskIds.has(task.id) && <Text style={styles.loggedBadge}>記録済み</Text>}
                  <View style={styles.taskActions}>
                    <TouchableOpacity onPress={() => startEditing(task)}>
                      <Text style={styles.subtleAction}>編集</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDeletingTaskId(task.id)}>
                      <Text style={styles.subtleAction}>削除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {deletingTaskId === task.id && (
                <View style={styles.confirmBox}>
                  <Text style={styles.confirmText}>
                    このタスクを削除しますか？
                    {loggedTaskIds.has(task.id) && "記録した感情ログも一緒に削除されます。"}
                  </Text>
                  <View style={styles.confirmActions}>
                    <TouchableOpacity
                      style={styles.confirmDeleteButton}
                      onPress={() => handleDeleteTask(task.id)}
                    >
                      <Text style={styles.confirmDeleteButtonText}>削除する</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setDeletingTaskId(null)}>
                      <Text style={styles.subtleAction}>やめる</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <View style={styles.statusRow}>
                {STATUS_ORDER.map((status) => {
                  const active = task.status === status;
                  const activeColor = STATUS_ACTIVE_COLOR[status];
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusButton,
                        active && { backgroundColor: activeColor, borderColor: activeColor },
                      ]}
                      onPress={() => handleStatusChange(task.id, status)}
                    >
                      <Text style={[styles.statusButtonText, active && styles.statusButtonTextActive]}>
                        {STATUS_LABEL[status]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {emotionPromptTaskId === task.id && (
                <EmotionLogForm
                  taskId={task.id}
                  onSaved={() => {
                    setLoggedTaskIds((prev) => new Set(prev).add(task.id));
                    setEmotionPromptTaskId(null);
                    setSummaryRefreshKey((k) => k + 1);
                  }}
                  onSkip={() => setEmotionPromptTaskId(null)}
                />
              )}
            </View>
          ))
        )}

        <View style={styles.addTaskRow}>
          <TextInput
            style={styles.addTaskInput}
            placeholder={`${dateLabel}のタスクを追加`}
            placeholderTextColor={colors.textMuted}
            value={newTaskTitle}
            onChangeText={setNewTaskTitle}
            onSubmitEditing={handleAddTask}
          />
          <TouchableOpacity style={styles.addTaskButton} onPress={handleAddTask}>
            <Text style={styles.addTaskButtonText}>追加</Text>
          </TouchableOpacity>
        </View>
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
    padding: spacing.xl,
  },
  content: {
    width: "100%",
    maxWidth: 640,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.lg,
  },
  eyebrow: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  navLinkButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  navLink: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  empty: {
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xxl,
    marginBottom: spacing.md,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  taskTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  taskTitle: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  loggedBadge: {
    fontSize: 11,
    color: colors.success,
    backgroundColor: colors.successMuted,
    borderRadius: radius.sm - 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    fontWeight: "600",
  },
  taskActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginLeft: "auto",
  },
  subtleAction: {
    fontSize: 12,
    color: colors.textMuted,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  editSaveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  editSaveButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  confirmBox: {
    backgroundColor: colors.neutralMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  confirmText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  confirmActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  confirmDeleteButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  confirmDeleteButtonText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm - 2,
    paddingHorizontal: spacing.md,
  },
  statusButtonText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  statusButtonTextActive: {
    color: colors.white,
  },
  addTaskRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addTaskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  addTaskButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  addTaskButtonText: {
    color: colors.white,
    fontWeight: "600",
  },
});
