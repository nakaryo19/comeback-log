-- 初期スキーマ
-- 参照: docs/要件定義書_v0.2.md セクション7（データモデル）, CLAUDE.md
-- User -> Goal -> SubGoal -> Task -> EmotionLog(Taskと1:1)
-- PublicProfile は EmotionLog / free_text へ参照不可（構造的に分離、RLSでも非公開を担保）

create extension if not exists pgcrypto;

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- goals（大目標）
-- ============================================================
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_id_idx on public.goals(user_id);

create trigger goals_set_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ============================================================
-- sub_goals（中目標。初回登録時は仮の中目標を自動生成）
-- ============================================================
create table public.sub_goals (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  is_provisional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sub_goals_goal_id_idx on public.sub_goals(goal_id);

create trigger sub_goals_set_updated_at
  before update on public.sub_goals
  for each row execute function public.set_updated_at();

-- ============================================================
-- tasks（日次タスク）
-- ============================================================
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  sub_goal_id uuid not null references public.sub_goals(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'done', 'partial')),
  date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_sub_goal_id_idx on public.tasks(sub_goal_id);
create index tasks_date_idx on public.tasks(date);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- ============================================================
-- emotion_logs（感情ログ。タスクと1:1）
-- ============================================================
create table public.emotion_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  score smallint not null check (score between 1 and 5),
  tag text,
  free_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger emotion_logs_set_updated_at
  before update on public.emotion_logs
  for each row execute function public.set_updated_at();

-- ============================================================
-- public_profiles（任意公開プロフィール。感情ログへは参照不可）
-- ============================================================
create table public.public_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  goal_summary text,
  achievement_rate numeric,
  streak_days integer,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger public_profiles_set_updated_at
  before update on public.public_profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS: goals（本人のみ）
-- ============================================================
alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);

create policy "goals_insert_own" on public.goals
  for insert with check (auth.uid() = user_id);

create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "goals_delete_own" on public.goals
  for delete using (auth.uid() = user_id);

-- ============================================================
-- RLS: sub_goals（goals経由で本人のみ）
-- ============================================================
alter table public.sub_goals enable row level security;

create policy "sub_goals_select_own" on public.sub_goals
  for select using (
    exists (
      select 1 from public.goals
      where goals.id = sub_goals.goal_id and goals.user_id = auth.uid()
    )
  );

create policy "sub_goals_insert_own" on public.sub_goals
  for insert with check (
    exists (
      select 1 from public.goals
      where goals.id = sub_goals.goal_id and goals.user_id = auth.uid()
    )
  );

create policy "sub_goals_update_own" on public.sub_goals
  for update using (
    exists (
      select 1 from public.goals
      where goals.id = sub_goals.goal_id and goals.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.goals
      where goals.id = sub_goals.goal_id and goals.user_id = auth.uid()
    )
  );

create policy "sub_goals_delete_own" on public.sub_goals
  for delete using (
    exists (
      select 1 from public.goals
      where goals.id = sub_goals.goal_id and goals.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: tasks（sub_goals -> goals経由で本人のみ）
-- ============================================================
alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (
    exists (
      select 1 from public.sub_goals
      join public.goals on goals.id = sub_goals.goal_id
      where sub_goals.id = tasks.sub_goal_id and goals.user_id = auth.uid()
    )
  );

create policy "tasks_insert_own" on public.tasks
  for insert with check (
    exists (
      select 1 from public.sub_goals
      join public.goals on goals.id = sub_goals.goal_id
      where sub_goals.id = tasks.sub_goal_id and goals.user_id = auth.uid()
    )
  );

create policy "tasks_update_own" on public.tasks
  for update using (
    exists (
      select 1 from public.sub_goals
      join public.goals on goals.id = sub_goals.goal_id
      where sub_goals.id = tasks.sub_goal_id and goals.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.sub_goals
      join public.goals on goals.id = sub_goals.goal_id
      where sub_goals.id = tasks.sub_goal_id and goals.user_id = auth.uid()
    )
  );

create policy "tasks_delete_own" on public.tasks
  for delete using (
    exists (
      select 1 from public.sub_goals
      join public.goals on goals.id = sub_goals.goal_id
      where sub_goals.id = tasks.sub_goal_id and goals.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: emotion_logs（本人のみ。公開ポリシーは一切設けない＝構造的に非公開を担保）
-- ============================================================
alter table public.emotion_logs enable row level security;

create policy "emotion_logs_select_own" on public.emotion_logs
  for select using (
    exists (
      select 1 from public.tasks
      join public.sub_goals on sub_goals.id = tasks.sub_goal_id
      join public.goals on goals.id = sub_goals.goal_id
      where tasks.id = emotion_logs.task_id and goals.user_id = auth.uid()
    )
  );

create policy "emotion_logs_insert_own" on public.emotion_logs
  for insert with check (
    exists (
      select 1 from public.tasks
      join public.sub_goals on sub_goals.id = tasks.sub_goal_id
      join public.goals on goals.id = sub_goals.goal_id
      where tasks.id = emotion_logs.task_id and goals.user_id = auth.uid()
    )
  );

create policy "emotion_logs_update_own" on public.emotion_logs
  for update using (
    exists (
      select 1 from public.tasks
      join public.sub_goals on sub_goals.id = tasks.sub_goal_id
      join public.goals on goals.id = sub_goals.goal_id
      where tasks.id = emotion_logs.task_id and goals.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.tasks
      join public.sub_goals on sub_goals.id = tasks.sub_goal_id
      join public.goals on goals.id = sub_goals.goal_id
      where tasks.id = emotion_logs.task_id and goals.user_id = auth.uid()
    )
  );

create policy "emotion_logs_delete_own" on public.emotion_logs
  for delete using (
    exists (
      select 1 from public.tasks
      join public.sub_goals on sub_goals.id = tasks.sub_goal_id
      join public.goals on goals.id = sub_goals.goal_id
      where tasks.id = emotion_logs.task_id and goals.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS: public_profiles（本人は全操作可、他人はis_public=trueの行のみSELECT可）
-- ============================================================
alter table public.public_profiles enable row level security;

create policy "public_profiles_select_own_or_public" on public.public_profiles
  for select using (auth.uid() = user_id or is_public = true);

create policy "public_profiles_insert_own" on public.public_profiles
  for insert with check (auth.uid() = user_id);

create policy "public_profiles_update_own" on public.public_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public_profiles_delete_own" on public.public_profiles
  for delete using (auth.uid() = user_id);
