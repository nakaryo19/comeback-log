-- 大目標・中目標そのものの達成状態を持たせる。
-- 参照: docs/要件定義書_v0.2.md 4-1（タスク管理）
--
-- boolean ではなく timestamptz にしている理由:
--   「達成したかどうか」だけでなく「いつ達成したか」が、このアプリでは意味を持つ。
--   Phase 2 の可視化で、達成の時点を時間軸上に置けるようにしておく。
--   null = 未達成、値あり = その日時に達成。
--
-- 達成はユーザーの手動操作でのみ設定する（タスクの完了状況とは連動させない）。
--   「公務員試験に合格する」の達成条件は試験に受かることであって、
--   タスクを全部消化することではないため。
--   自動達成にすると、後からタスクを1件足した瞬間に達成が外れ、記録として不安定になる。

alter table public.goals
  add column achieved_at timestamptz;

alter table public.sub_goals
  add column achieved_at timestamptz;

comment on column public.goals.achieved_at is
  '大目標を達成した日時。null は未達成。ユーザーの手動操作でのみ設定する。';

comment on column public.sub_goals.achieved_at is
  '中目標を達成した日時。null は未達成。ユーザーの手動操作でのみ設定する。';

-- 既存のRLSポリシー（goals_update_own / sub_goals_update_own）が
-- そのまま適用されるため、ポリシーの追加は不要。
