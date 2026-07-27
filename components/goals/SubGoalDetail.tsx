import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { fetchTasksForSubGoal } from "../../lib/supabase/tasks";
import type { SubGoal, Task, TaskStatus } from "../../types/database";
import { colors, hitSlop, radius, shadow, spacing } from "../../lib/theme";

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "未完了",
  partial: "部分達成",
  done: "完了",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: colors.neutral,
  partial: colors.warning,
  done: colors.success,
};

/**
 * 中目標に紐づくタスクの全件表示。
 * 目標管理画面の一覧は先頭数件しか出さないため、溜まった記録はここで確認する。
 * 集計やグラフは Phase 2 の担当なので、ここでは一覧表示に徹する。
 */
export function SubGoalDetail({ subGoal, onBack }: { subGoal: SubGoal; onBack: () => void }) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTasksForSubGoal(subGoal.id)
      .then((fetched) => {
        if (!cancelled) setTasks(fetched);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "タスクの取得に失敗しました。");
      });
    return () => {
      cancelled = true;
    };
  }, [subGoal.id]);

  const doneCount = tasks?.filter((t) => t.status === "done").length ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity hitSlop={hitSlop} onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← 目標管理へ</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>中目標</Text>
        <Text style={styles.title}>{subGoal.title}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {tasks === null ? (
          <Text style={styles.muted}>読み込み中...</Text>
        ) : tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.muted}>この中目標のタスクはまだありません</Text>
          </View>
        ) : (
          <>
            <Text style={styles.summary}>
              全 {tasks.length} 件 / 完了 {doneCount} 件
            </Text>
            {tasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskRow}>
                  <Text style={styles.taskDate}>{task.date}</Text>
                  <Text style={[styles.statusBadge, { color: STATUS_COLOR[task.status] }]}>
                    {STATUS_LABEL[task.status]}
                  </Text>
                </View>
                <Text style={styles.taskTitle}>{task.title}</Text>
              </View>
            ))}
          </>
        )}
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
  backLink: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  navLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  eyebrow: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  summary: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  muted: {
    color: colors.textMuted,
    textAlign: "center",
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xxl,
  },
  taskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginBottom: spacing.sm + 2,
    ...shadow.card,
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  taskDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: "600",
  },
  taskTitle: {
    fontSize: 15,
    color: colors.textPrimary,
  },
});
