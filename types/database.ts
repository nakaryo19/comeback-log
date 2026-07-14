/**
 * データモデル型定義
 * 参照: CLAUDE.md「データモデル（要件定義書より抜粋）」
 *
 * User -> Goal -> SubGoal -> Task -> EmotionLog（Taskと1:1）
 * PublicProfile は EmotionLog / free_text へ参照不可（構造的に分離）
 */

export type UUID = string;
export type ISODateString = string; // 例: "2026-07-13"
export type ISODateTimeString = string; // 例: "2026-07-13T12:00:00Z"

/** 完了 / 未完了 / 部分達成（要件定義書 4-1, 7） */
export type TaskStatus = "todo" | "done" | "partial";

// Row/Insert/Update型がSupabaseの GenericTable（Record<string, unknown>）制約を満たす必要があるため、
// interfaceではなくtypeで宣言する（interfaceは暗黙のインデックスシグネチャを持たず、制約を満たせない）。
export type Goal = {
  id: UUID;
  user_id: UUID;
  title: string;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type SubGoal = {
  id: UUID;
  goal_id: UUID;
  title: string;
  /** 初回登録時に自動生成される「仮の中目標」かどうか */
  is_provisional: boolean;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type Task = {
  id: UUID;
  sub_goal_id: UUID;
  title: string;
  status: TaskStatus;
  date: ISODateString;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type EmotionScore = 1 | 2 | 3 | 4 | 5;

export type EmotionLog = {
  id: UUID;
  /** タスクと1:1で紐付け */
  task_id: UUID;
  score: EmotionScore;
  tag: string | null;
  free_text: string | null;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

export type PublicProfile = {
  id: UUID;
  user_id: UUID;
  goal_summary: string | null;
  achievement_rate: number | null;
  streak_days: number | null;
  is_public: boolean;
  created_at: ISODateTimeString;
  updated_at: ISODateTimeString;
};

/**
 * Supabaseクライアントに渡すDBスキーマ型。
 * `supabase.from("goals")` 等の型推論に利用する。
 */
export interface Database {
  public: {
    Tables: {
      goals: {
        Row: Goal;
        Insert: Omit<Goal, "id" | "created_at" | "updated_at"> &
          Partial<Pick<Goal, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<Goal, "id">>;
        Relationships: [];
      };
      sub_goals: {
        Row: SubGoal;
        Insert: Omit<SubGoal, "id" | "created_at" | "updated_at"> &
          Partial<Pick<SubGoal, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<SubGoal, "id">>;
        Relationships: [];
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at" | "updated_at"> &
          Partial<Pick<Task, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<Task, "id">>;
        Relationships: [];
      };
      emotion_logs: {
        Row: EmotionLog;
        Insert: Omit<EmotionLog, "id" | "created_at" | "updated_at"> &
          Partial<Pick<EmotionLog, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<EmotionLog, "id">>;
        Relationships: [];
      };
      public_profiles: {
        Row: PublicProfile;
        Insert: Omit<PublicProfile, "id" | "created_at" | "updated_at"> &
          Partial<Pick<PublicProfile, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<PublicProfile, "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
