import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import type { GoalWithSubGoals } from "../../lib/supabase/goals";
import {
  createGoal,
  createSubGoal,
  deleteGoal,
  deleteSubGoal,
  renameGoal,
  renameSubGoal,
  setGoalAchieved,
  setSubGoalAchieved,
} from "../../lib/supabase/goals";
import {
  fetchTaskCountsBySubGoal,
  fetchTaskIdsForSubGoals,
  fetchTasksForSubGoals,
  reassignTask,
} from "../../lib/supabase/tasks";
import { countEmotionLogsForTasks } from "../../lib/supabase/emotionLogs";
import { useAuth } from "../../lib/supabase/auth-context";
import { SubGoalDetail } from "./SubGoalDetail";
import type { SubGoal, Task } from "../../types/database";
import { colors, radius, shadow, spacing } from "../../lib/theme";

/** 達成日時（ISO文字列）を「7/26」形式にする */
function formatAchievedDate(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** 既定で表示する中目標の件数。これを超える分は「他N件を表示」で展開する */
const SUB_GOAL_PREVIEW_COUNT = 3;

/** 中目標カードに出すタスクの件数。これを超える分は中目標の詳細画面で見る */
const TASK_PREVIEW_COUNT = 3;

type PendingDelete = {
  kind: "goal" | "subGoal";
  id: string;
  title: string;
  /** 消える件数。集計が終わるまでは null */
  impact: { tasks: number; emotionLogs: number } | null;
};

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
  const [expandedGoalIds, setExpandedGoalIds] = useState<Set<string>>(new Set());
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({});
  const [showAchieved, setShowAchieved] = useState(false);
  const [detailSubGoal, setDetailSubGoal] = useState<SubGoal | null>(null);
  // 削除確認中の対象と、そこで消えるデータの件数（数え終わるまでは null）
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  // 達成済みは下部の折りたたみへ回し、進行中に集中できるようにする
  const activeGoals = useMemo(() => goals.filter((g) => g.achieved_at === null), [goals]);
  const achievedGoals = useMemo(() => goals.filter((g) => g.achieved_at !== null), [goals]);

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
      .then(() => fetchTaskCountsBySubGoal(allSubGoalIds))
      .then((counts) => {
        if (counts) setTaskCounts(counts);
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

  /**
   * 削除確認を開き、実際に消えるタスク・感情ログの件数を数える。
   * 感情ログは本アプリで最も失いたくないデータのため、
   * 「消えます」という警告文ではなく具体的な件数を出す。
   */
  async function requestDelete(kind: PendingDelete["kind"], id: string, title: string) {
    setPendingDelete({ kind, id, title, impact: null });
    const subGoalIds =
      kind === "goal"
        ? (goals.find((goal) => goal.id === id)?.sub_goals ?? []).map((s) => s.id)
        : [id];
    try {
      const taskIds = await fetchTaskIdsForSubGoals(subGoalIds);
      const emotionLogs = await countEmotionLogsForTasks(taskIds);
      setPendingDelete((prev) =>
        prev && prev.id === id ? { ...prev, impact: { tasks: taskIds.length, emotionLogs } } : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除対象の件数の取得に失敗しました。");
      setPendingDelete(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { kind, id } = pendingDelete;
    setPendingDelete(null);
    try {
      if (kind === "goal") {
        await deleteGoal(id);
      } else {
        await deleteSubGoal(id);
      }
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "削除に失敗しました。");
    }
  }

  /** 記録が溜まった際のスクロール量を抑えるため、既定では先頭数件のみ見せる */
  function visibleSubGoals(goal: GoalWithSubGoals): SubGoal[] {
    // 達成済みの中目標は末尾へ回す。進行中のものが先に目に入るようにするため
    const ordered = [...goal.sub_goals].sort(
      (a, b) => Number(a.achieved_at !== null) - Number(b.achieved_at !== null),
    );
    if (expandedGoalIds.has(goal.id)) return ordered;
    return ordered.slice(0, SUB_GOAL_PREVIEW_COUNT);
  }

  async function handleToggleGoalAchieved(goal: GoalWithSubGoals) {
    try {
      await setGoalAchieved(goal.id, goal.achieved_at === null);
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "大目標の達成状態の更新に失敗しました。");
    }
  }

  async function handleToggleSubGoalAchieved(subGoal: SubGoal) {
    try {
      await setSubGoalAchieved(subGoal.id, subGoal.achieved_at === null);
      onGoalsChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "中目標の達成状態の更新に失敗しました。");
    }
  }

  function toggleExpanded(goalId: string) {
    setExpandedGoalIds((prev) => {
      const next = new Set(prev);
      if (next.has(goalId)) {
        next.delete(goalId);
      } else {
        next.add(goalId);
      }
      return next;
    });
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

  if (detailSubGoal) {
    return <SubGoalDetail subGoal={detailSubGoal} onBack={() => setDetailSubGoal(null)} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} style={styles.backLink}>
          <Text style={styles.navLink}>← ホームへ</Text>
        </TouchableOpacity>
        <Text style={styles.title}>目標管理</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {activeGoals.map((goal) => renderGoal(goal))}

        {achievedGoals.length > 0 && (
          <View style={styles.achievedSection}>
            <TouchableOpacity
              style={styles.achievedHeader}
              accessibilityRole="button"
              onPress={() => setShowAchieved((prev) => !prev)}
            >
              <Text style={styles.achievedHeaderText}>
                達成した大目標（{achievedGoals.length}件）{showAchieved ? " ▲" : " ▼"}
              </Text>
            </TouchableOpacity>
            {showAchieved && achievedGoals.map((goal) => renderGoal(goal))}
          </View>
        )}

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

  function renderGoal(goal: GoalWithSubGoals) {
    return (
          <View key={goal.id} style={styles.goalSection}>
            <View style={styles.goalHeaderRow}>
              <TextInput
                style={styles.goalTitleInput}
                value={goalDraftFor(goal)}
                accessibilityLabel="大目標"
                onChangeText={(value) => setGoalDrafts((prev) => ({ ...prev, [goal.id]: value }))}
                onBlur={() => handleRenameGoal(goal)}
                onSubmitEditing={() => handleRenameGoal(goal)}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  goal.achieved_at === null
                    ? `大目標「${goal.title}」を達成にする`
                    : `大目標「${goal.title}」の達成を取り消す`
                }
                onPress={() => handleToggleGoalAchieved(goal)}
              >
                <Text style={goal.achieved_at === null ? styles.achieveAction : styles.subtleAction}>
                  {goal.achieved_at === null ? "達成にする" : "達成を取り消す"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`大目標「${goal.title}」を削除`}
                onPress={() => requestDelete("goal", goal.id, goal.title)}
              >
                <Text style={styles.subtleAction}>削除</Text>
              </TouchableOpacity>
            </View>

            {goal.achieved_at && (
              <Text style={styles.achievedBadge}>
                ✓ {formatAchievedDate(goal.achieved_at)} に達成
              </Text>
            )}

            {pendingDelete?.kind === "goal" && pendingDelete.id === goal.id && (
              <DeleteConfirm
                pending={pendingDelete}
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmDelete}
              />
            )}

            {visibleSubGoals(goal).map((subGoal) => {
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
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={
                        subGoal.achieved_at === null
                          ? `中目標「${subGoal.title}」を達成にする`
                          : `中目標「${subGoal.title}」の達成を取り消す`
                      }
                      onPress={() => handleToggleSubGoalAchieved(subGoal)}
                    >
                      <Text
                        style={
                          subGoal.achieved_at === null ? styles.achieveAction : styles.subtleAction
                        }
                      >
                        {subGoal.achieved_at === null ? "達成" : "取消"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`中目標「${subGoal.title}」を削除`}
                      onPress={() => requestDelete("subGoal", subGoal.id, subGoal.title)}
                    >
                      <Text style={styles.subtleAction}>削除</Text>
                    </TouchableOpacity>
                  </View>

                  {subGoal.achieved_at && (
                    <Text style={styles.achievedBadge}>
                      ✓ {formatAchievedDate(subGoal.achieved_at)} に達成
                    </Text>
                  )}

                  {pendingDelete?.kind === "subGoal" && pendingDelete.id === subGoal.id && (
                    <DeleteConfirm
                      pending={pendingDelete}
                      onCancel={() => setPendingDelete(null)}
                      onConfirm={confirmDelete}
                    />
                  )}

                  {tasks.length > 0 && (
                    <View style={styles.taskList}>
                      {tasks.slice(0, TASK_PREVIEW_COUNT).map((task) => (
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

                  {(taskCounts[subGoal.id] ?? tasks.length) > TASK_PREVIEW_COUNT && (
                    <TouchableOpacity
                      style={styles.detailLink}
                      accessibilityRole="button"
                      accessibilityLabel={`中目標「${subGoal.title}」のタスクをすべて見る`}
                      onPress={() => setDetailSubGoal(subGoal)}
                    >
                      <Text style={styles.detailLinkText}>
                        すべて見る（{taskCounts[subGoal.id] ?? tasks.length} 件）
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}

            {goal.sub_goals.length > SUB_GOAL_PREVIEW_COUNT && (
              <TouchableOpacity style={styles.expandButton} onPress={() => toggleExpanded(goal.id)}>
                <Text style={styles.expandButtonText}>
                  {expandedGoalIds.has(goal.id)
                    ? "中目標を折りたたむ"
                    : `他 ${goal.sub_goals.length - SUB_GOAL_PREVIEW_COUNT} 件の中目標を表示`}
                </Text>
              </TouchableOpacity>
            )}

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
    );
  }
}

/**
 * 削除確認。消えるタスク・感情ログの件数を具体的に示す。
 * 件数を伴わない警告文は読み飛ばされるため、数え終わるまで削除ボタンを押せなくしている。
 */
function DeleteConfirm({
  pending,
  onCancel,
  onConfirm,
}: {
  pending: PendingDelete;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label = pending.kind === "goal" ? "大目標" : "中目標";
  const { impact } = pending;

  return (
    <View style={styles.confirmBox}>
      <Text style={styles.confirmText}>
        {label}「{pending.title}」を削除しますか？
      </Text>
      {impact === null ? (
        <Text style={styles.confirmDetail}>削除される内容を確認しています...</Text>
      ) : (
        <Text style={styles.confirmDetail}>
          {pending.kind === "goal" && "配下の中目標と、"}
          タスク {impact.tasks} 件
          {impact.emotionLogs > 0 && `、記録した感情ログ ${impact.emotionLogs} 件`}
          も一緒に削除されます。元に戻せません。
        </Text>
      )}
      <View style={styles.confirmActions}>
        <TouchableOpacity
          style={[styles.confirmDeleteButton, impact === null && styles.confirmDeleteButtonDisabled]}
          disabled={impact === null}
          onPress={onConfirm}
        >
          <Text style={styles.confirmDeleteButtonText}>削除する</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.subtleAction}>やめる</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  goalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  goalTitleInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: "600",
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  subtleAction: {
    fontSize: 12,
    color: colors.textMuted,
  },
  achieveAction: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  achievedBadge: {
    alignSelf: "flex-start",
    fontSize: 11,
    color: colors.success,
    backgroundColor: colors.successMuted,
    borderRadius: radius.sm - 4,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    fontWeight: "600",
    marginBottom: spacing.sm,
  },
  achievedSection: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  achievedHeader: {
    alignSelf: "flex-start",
    marginBottom: spacing.md,
  },
  achievedHeaderText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  detailLink: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
  },
  detailLinkText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
  },
  expandButton: {
    alignSelf: "flex-start",
    marginBottom: spacing.sm + 2,
  },
  expandButtonText: {
    fontSize: 12,
    color: colors.primary,
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
    color: colors.textPrimary,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  confirmDetail: {
    fontSize: 12,
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
  confirmDeleteButtonDisabled: {
    opacity: 0.5,
  },
  confirmDeleteButtonText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: "600",
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
