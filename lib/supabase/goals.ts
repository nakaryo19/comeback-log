import { supabase } from "./client";
import type { Goal, SubGoal, UUID } from "../../types/database";

export interface GoalWithSubGoals extends Goal {
  sub_goals: SubGoal[];
}

/** ユーザーのゴールツリー（大目標→中目標）を取得する */
export async function fetchGoalTree(userId: UUID): Promise<GoalWithSubGoals[]> {
  const { data: goals, error: goalsError } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (goalsError) throw goalsError;
  if (!goals || goals.length === 0) return [];

  const { data: subGoals, error: subGoalsError } = await supabase
    .from("sub_goals")
    .select("*")
    .in(
      "goal_id",
      goals.map((goal) => goal.id),
    )
    .order("created_at", { ascending: true });
  if (subGoalsError) throw subGoalsError;

  return goals.map((goal) => ({
    ...goal,
    sub_goals: (subGoals ?? []).filter((subGoal) => subGoal.goal_id === goal.id),
  }));
}

/**
 * オンボーディング：大目標＋仮の中目標＋初回タスク群を作成する。
 * 参照: docs/要件定義書_v0.2.md 4-1「ゴールツリーの入力フロー」
 */
export async function createGoalWithInitialTasks(params: {
  userId: UUID;
  goalTitle: string;
  taskTitles: string[];
  date: string;
}): Promise<void> {
  const { userId, goalTitle, taskTitles, date } = params;

  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({ user_id: userId, title: goalTitle })
    .select()
    .single();
  if (goalError) throw goalError;

  const { data: subGoal, error: subGoalError } = await supabase
    .from("sub_goals")
    .insert({ goal_id: goal.id, title: "ステップ1", is_provisional: true })
    .select()
    .single();
  if (subGoalError) throw subGoalError;

  const { error: tasksError } = await supabase.from("tasks").insert(
    taskTitles.map((title) => ({
      sub_goal_id: subGoal.id,
      title,
      status: "todo" as const,
      date,
    })),
  );
  if (tasksError) throw tasksError;
}

/**
 * 2つ目以降の大目標を追加する。
 * オンボーディングと同様に「仮の中目標」を自動生成する。
 * データ構造上は常に3階層を維持する必要があり（要件定義書 4-1）、
 * 中目標が無い大目標にはタスクを紐付けられないため。
 */
export async function createGoal(userId: UUID, title: string): Promise<Goal> {
  const { data: goal, error: goalError } = await supabase
    .from("goals")
    .insert({ user_id: userId, title })
    .select()
    .single();
  if (goalError) throw goalError;

  const { error: subGoalError } = await supabase
    .from("sub_goals")
    .insert({ goal_id: goal.id, title: "ステップ1", is_provisional: true });
  if (subGoalError) throw subGoalError;

  return goal;
}

export async function renameGoal(goalId: UUID, title: string): Promise<void> {
  const { error } = await supabase.from("goals").update({ title }).eq("id", goalId);
  if (error) throw error;
}

/** 中目標の名前を変更する。命名により「仮の中目標」ではなくなる */
export async function renameSubGoal(subGoalId: UUID, title: string): Promise<void> {
  const { error } = await supabase
    .from("sub_goals")
    .update({ title, is_provisional: false })
    .eq("id", subGoalId);
  if (error) throw error;
}

/**
 * 大目標の達成状態を切り替える。
 * 達成はユーザーの手動操作でのみ設定し、タスクの完了状況とは連動させない
 * （達成条件はタスクの消化とは別物であり、後からタスクを足しても達成が揺らがないようにするため）。
 */
export async function setGoalAchieved(goalId: UUID, achieved: boolean): Promise<void> {
  const { error } = await supabase
    .from("goals")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", goalId);
  if (error) throw error;
}

/** 中目標の達成状態を切り替える（setGoalAchieved と同じ方針） */
export async function setSubGoalAchieved(subGoalId: UUID, achieved: boolean): Promise<void> {
  const { error } = await supabase
    .from("sub_goals")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", subGoalId);
  if (error) throw error;
}

/**
 * 大目標を削除する。
 * 配下の中目標・タスク・感情ログもDBの on delete cascade で同時に消える。
 * 呼び出し側は削除前に、消える感情ログの件数を必ずユーザーに提示すること。
 */
export async function deleteGoal(goalId: UUID): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
}

/** 中目標を削除する。配下のタスク・感情ログも同時に消える（deleteGoal と同じ注意が要る） */
export async function deleteSubGoal(subGoalId: UUID): Promise<void> {
  const { error } = await supabase.from("sub_goals").delete().eq("id", subGoalId);
  if (error) throw error;
}

export async function createSubGoal(goalId: UUID, title: string): Promise<SubGoal> {
  const { data, error } = await supabase
    .from("sub_goals")
    .insert({ goal_id: goalId, title, is_provisional: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * 未指定時にタスクを紐付ける中目標を決める：直近の仮の中目標、無ければ直近の中目標。
 * 達成済みの大目標・中目標は候補から除く（終わった目標に新しいタスクは足さないため）。
 * ただし全部が達成済みなら、行き先が無くなるのを避けて達成済みも候補に戻す。
 */
export function findDefaultSubGoalId(goals: GoalWithSubGoals[]): UUID | null {
  const activeSubGoals = goals
    .filter((goal) => goal.achieved_at === null)
    .flatMap((goal) => goal.sub_goals)
    .filter((subGoal) => subGoal.achieved_at === null);

  const subGoals =
    activeSubGoals.length > 0 ? activeSubGoals : goals.flatMap((goal) => goal.sub_goals);
  const byNewest = (a: SubGoal, b: SubGoal) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const provisional = subGoals.filter((subGoal) => subGoal.is_provisional).sort(byNewest);
  if (provisional.length > 0) return provisional[0].id;

  const all = [...subGoals].sort(byNewest);
  return all[0]?.id ?? null;
}
