import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { GoalWithSubGoals } from "../../lib/supabase/goals";
import { createSubGoal, renameSubGoal } from "../../lib/supabase/goals";
import { fetchTasksForSubGoals, reassignTask } from "../../lib/supabase/tasks";
import type { SubGoal, Task } from "../../types/database";

export function GoalManagementScreen({
  goals,
  onBack,
  onGoalsChanged,
}: {
  goals: GoalWithSubGoals[];
  onBack: () => void;
  onGoalsChanged: () => void;
}) {
  const [tasksBySubGoal, setTasksBySubGoal] = useState<Record<string, Task[]>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newSubGoalTitles, setNewSubGoalTitles] = useState<Record<string, string>>({});
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
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.navLink}>← ホームへ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>目標管理</Text>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {goals.map((goal) => (
        <View key={goal.id} style={styles.goalSection}>
          <Text style={styles.goalTitle}>{goal.title}</Text>

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
    marginBottom: 16,
  },
  navLink: {
    color: "#2563eb",
    fontSize: 14,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  error: {
    color: "#b91c1c",
    marginBottom: 12,
  },
  goalSection: {
    marginBottom: 24,
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
  },
  subGoalCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  subGoalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 6,
    padding: 8,
    fontSize: 15,
  },
  badge: {
    fontSize: 12,
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  taskList: {
    marginTop: 10,
    gap: 8,
  },
  taskRow: {
    borderTopWidth: 1,
    borderTopColor: "#f2f2f2",
    paddingTop: 8,
  },
  taskText: {
    fontSize: 13,
    color: "#333",
    marginBottom: 4,
  },
  moveRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  moveChip: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  moveChipText: {
    fontSize: 11,
    color: "#555",
  },
  addSubGoalRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  addSubGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
  },
  addSubGoalButton: {
    backgroundColor: "#2563eb",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  addSubGoalButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
});
