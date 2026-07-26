import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { GoalWithSubGoals } from "../../lib/supabase/goals";
import { createGoal, createSubGoal, renameGoal, renameSubGoal } from "../../lib/supabase/goals";
import { fetchTasksForSubGoals, reassignTask } from "../../lib/supabase/tasks";
import { useAuth } from "../../lib/supabase/auth-context";
import type { SubGoal, Task } from "../../types/database";
import { colors, radius, shadow, spacing } from "../../lib/theme";

export function GoalManagementScreen({
  goals,
  onBack,
  onGoalsChanged,
}: {
  goals: GoalWithSubGoals[];
  onBack: () => void;
  onGoalsChanged: () => void;
}) {
  const { user } = useAuth();
  const [tasksBySubGoal, setTasksBySubGoal] = useState<Record<string, Task[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [goalDrafts, setGoalDrafts] = useState<Record<string, string>>({});
  const [newSubGoalTitles, setNewSubGoalTitles] = useState<Record<string, string>>({});
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const allSubGoalIds = useMemo(
    () => goals.flatMap((goal) => goal.sub_goals).map((subGoal) => subGoal.id),
    [goals],
  );

  useEffect(() => {
    fetchTasksForSubGoals(allSubGoalIds)
      .then((tasks) => {
        const grouped: Record<string, Task[]> = {};
        for (const task of tasks) {
          (grouped[task.sub_goal_id] ??= []).push(task);
        }
        setTasksBySubGoal(grouped);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "タスクの取得に失敗しました。"));
  }, [allSubGoalIds]);

  function draftFor(subGoal: SubGoal): string {
    return drafts[subGoal.id] ?? subGoal.title;
  }

  async function handleRename(subGoal: SubGoal) {
    const title = draftFor(subGoal).trim();
    if (!title || title === subGoal.title) return;
    try {
      await renameSubGoal(subGoal.id, title);
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "中目標の更新に失敗しました。");
    }
  }

  function goalDraftFor(goal: GoalWithSubGoals): string {
    return goalDrafts[goal.id] ?? goal.title;
  }

  async function handleRenameGoal(goal: GoalWithSubGoals) {
    const title = goalDraftFor(goal).trim();
    if (!title || title === goal.title) return;
    try {
      await renameGoal(goal.id, title);
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "大目標の更新に失敗しました。");
    }
  }

  async function handleAddGoal() {
    const title = newGoalTitle.trim();
    if (!title || !user) return;
    try {
      await createGoal(user.id, title);
      setNewGoalTitle("");
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "大目標の追加に失敗しました。");
    }
  }

  async function handleAddSubGoal(goalId: string) {
    const title = (newSubGoalTitles[goalId] ?? "").trim();
    if (!title) return;
    try {
      await createSubGoal(goalId, title);
      setNewSubGoalTitles((prev) => ({ ...prev, [goalId]: "" }));
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "中目標の追加に失敗しました。");
    }
  }

  async function handleMoveTask(task: Task, targetSubGoalId: string) {
    setTasksBySubGoal((prev) => {
      const next = { ...prev };
      next[task.sub_goal_id] = (next[task.sub_goal_id] ?? []).filter((t) => t.id !== task.id);
      next[targetSubGoalId] = [...(next[targetSubGoalId] ?? []), { ...task, sub_goal_id: targetSubGoalId }];
      return next;
    });
    try {
      await reassignTask(task.id, targetSubGoalId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "タスクの付け替えに失敗しました。");
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← ホームへ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>目標管理</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {goals.map((goal) => (
          <View key={goal.id} style={styles.goalSection}>
            <TextInput
              style={styles.goalTitleInput}
              value={goalDraftFor(goal)}
              accessibilityLabel="大目標"
              onChangeText={(value) => setGoalDrafts((prev) => ({ ...prev, [goal.id]: value }))}
              onBlur={() => handleRenameGoal(goal)}
              onSubmitEditing={() => handleRenameGoal(goal)}
            />

            {goal.sub_goals.map((subGoal) => {
              const otherSubGoals = goal.sub_goals.filter((s) => s.id !== subGoal.id);
              const tasks = tasksBySubGoal[subGoal.id] ?? [];
              return (
                <View key={subGoal.id} style={styles.subGoalCard}>
                  <View style={styles.subGoalHeaderRow}>
                    <TextInput
                      style={styles.subGoalInput}
                      value={draftFor(subGoal)}
                      onChangeText={(value) =>
                        setDrafts((prev) => ({ ...prev, [subGoal.id]: value }))
                      }
                      onBlur={() => handleRename(subGoal)}
                      onSubmitEditing={() => handleRename(subGoal)}
                    />
                    {subGoal.is_provisional && <Text style={styles.badge}>仮</Text>}
                  </View>

                  {tasks.length > 0 && (
                    <View style={styles.taskList}>
                      {tasks.map((task) => (
                        <View key={task.id} style={styles.taskRow}>
                          <Text style={styles.taskText} numberOfLines={1}>
                            {task.date}　{task.title}
                          </Text>
                          {otherSubGoals.length > 0 && (
                            <View style={styles.moveRow}>
                              {otherSubGoals.map((target) => (
                                <TouchableOpacity
                                  key={target.id}
                                  style={styles.moveChip}
                                  onPress={() => handleMoveTask(task, target.id)}
                                >
                                  <Text style={styles.moveChipText}>→ {target.title}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            <View style={styles.addSubGoalRow}>
              <TextInput
                style={styles.addSubGoalInput}
                placeholder="中目標を追加"
                placeholderTextColor={colors.textMuted}
                value={newSubGoalTitles[goal.id] ?? ""}
                onChangeText={(value) =>
                  setNewSubGoalTitles((prev) => ({ ...prev, [goal.id]: value }))
                }
                onSubmitEditing={() => handleAddSubGoal(goal.id)}
              />
              <TouchableOpacity
                style={styles.addSubGoalButton}
                onPress={() => handleAddSubGoal(goal.id)}
              >
                <Text style={styles.addSubGoalButtonText}>追加</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.addGoalCard}>
          <Text style={styles.addGoalLabel}>大目標を追加</Text>
          <Text style={styles.addGoalHint}>
            並行して追いかけている目標は、分けて管理できます
          </Text>
          <View style={styles.addGoalRow}>
            <TextInput
              style={styles.addGoalInput}
              placeholder="例：AWS認定資格を取得する"
              placeholderTextColor={colors.textMuted}
              value={newGoalTitle}
              onChangeText={setNewGoalTitle}
              onSubmitEditing={handleAddGoal}
            />
            <TouchableOpacity
              style={styles.addSubGoalButton}
              accessibilityRole="button"
              accessibilityLabel="大目標を追加する"
              onPress={handleAddGoal}
            >
              <Text style={styles.addSubGoalButtonText}>追加</Text>
            </TouchableOpacity>
          </View>
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
  backLink: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  navLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.danger,
    marginBottom: spacing.md,
  },
  goalSection: {
    marginBottom: spacing.xxl,
  },
  goalTitleInput: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
  },
  addGoalCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
  },
  addGoalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  addGoalHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  addGoalRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  addGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    fontSize: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  subGoalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginBottom: spacing.sm + 2,
    ...shadow.card,
  },
  subGoalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  subGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm - 2,
    padding: spacing.sm,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  badge: {
    fontSize: 12,
    color: colors.warning,
    backgroundColor: colors.warningMuted,
    borderRadius: radius.sm - 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    fontWeight: "600",
  },
  taskList: {
    marginTop: spacing.sm + 2,
    gap: spacing.sm,
  },
  taskRow: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  taskText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  moveRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs + 2,
  },
  moveChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
  },
  moveChipText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  addSubGoalRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  addSubGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm + 2,
    fontSize: 14,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  addSubGoalButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
  },
  addSubGoalButtonText: {
    color: colors.white,
    fontWeight: "600",
  },
});
