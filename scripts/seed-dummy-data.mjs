#!/usr/bin/env node
/**
 * Phase 2（可視化ダッシュボード）の開発用に、テストアカウントへダミーデータを投入する。
 *
 * 設計上の判断が2つある。
 *
 * 1. service role キーを使わず、テストアカウントとして「ログインして」書き込む。
 *    RLS が効いたままになるため、このスクリプトは他ユーザー（＝実アカウント）の
 *    データに構造的に触れられない。強力なキーを扱わずに済むぶん、事故の余地が小さい。
 *
 * 2. 日々の調子を潜在変数（ランダムウォーク）として持ち、そこから達成率と感情スコアの
 *    両方を生成している。しきい値に合わせてデータを作ると、自分で作ったデータに
 *    自分で作ったしきい値を当てることになり、検証が循環する。相関は「生成の結果として
 *    現れる」ようにしてあり、ハイライト判定の当たり外れを見る材料になる。
 *
 * 使い方:
 *   SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-dummy-data.mjs --weeks=12
 *   SEED_EMAIL=... SEED_PASSWORD=... node scripts/seed-dummy-data.mjs --clean --yes
 *
 * 商用リリース前に --clean で必ず消すこと（チェックリスト §2-2 参照）。
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------- 設定の読み込み

function loadEnvLocal() {
  const env = {};
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env.local が無ければ環境変数だけで動かす
  }
  return env;
}

const fileEnv = loadEnvLocal();
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? fileEnv.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? fileEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const EMAIL = process.env.SEED_EMAIL;
const PASSWORD = process.env.SEED_PASSWORD;

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const weeks = Number((args.find((a) => a.startsWith("--weeks=")) ?? "--weeks=12").split("=")[1]);

function fail(message) {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) fail(".env.local に Supabase の URL と anon キーが必要です。");
if (!EMAIL || !PASSWORD) fail("SEED_EMAIL と SEED_PASSWORD を環境変数で渡してください。");
if (!Number.isInteger(weeks) || weeks < 1 || weeks > 104) fail("--weeks は 1〜104 で指定してください。");

// ---------------------------------------------------------------- 乱数（再現性のため固定シード）

/** 同じシードなら毎回同じデータになる。データを作り直しても比較ができる */
function makeRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260727);
const pick = (list) => list[Math.floor(random() * list.length)];
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------- 日付

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function shiftDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// ---------------------------------------------------------------- 投入するゴールツリー

const GOAL_TREE = [
  {
    title: "AWS認定資格に合格する",
    subGoals: [
      { title: "基礎サービスを一通り理解する", achieved: true, tasks: ["公式ドキュメントを読む", "ハンズオンを1つ進める", "用語をノートにまとめる"] },
      { title: "模擬試験で8割を取る", achieved: false, tasks: ["模擬試験を1回分解く", "間違えた問題を復習する", "苦手分野の章を読み直す"] },
      { title: "本番試験を申し込む", achieved: false, tasks: ["受験日を決める", "会場を調べる"] },
    ],
  },
  {
    title: "個人開発アプリをリリースする",
    subGoals: [
      { title: "コア機能を作り切る", achieved: false, tasks: ["画面を1つ実装する", "テストを書く", "バグを1件直す", "設計をメモに残す"] },
      { title: "ストア申請の準備をする", achieved: false, tasks: ["アイコンを作る", "説明文を書く", "スクリーンショットを撮る"] },
    ],
  },
];

const TAGS = ["不安", "達成感", "焦り", "集中", "疲労"];

/** スコア帯ごとの文面。実データの機微な内容は模さず、当たり障りのない範囲に留める */
const FREE_TEXTS = {
  low: ["思ったより進まなかった", "集中が続かなかった", "疲れが残っている", ""],
  mid: ["ひとまず手はつけられた", "可もなく不可もなく", ""],
  high: ["思ったより進んだ", "手応えがあった", "いい流れだった", ""],
};

// ---------------------------------------------------------------- 生成

/**
 * 「その日の調子」をランダムウォークで動かし、そこから
 * タスク量・完了率・感情スコアをまとめて導く。
 * 相関はこの共通の潜在変数から自然に生まれる（しきい値には合わせない）。
 */
function generateDays(weeksCount) {
  const days = [];
  const today = new Date();
  const start = shiftDays(today, -(weeksCount * 7 - 1));
  let condition = 0.5;

  for (let i = 0; i < weeksCount * 7; i++) {
    const date = shiftDays(start, i);
    // 平均へ戻る力を入れる。単純なランダムウォークだと高いまま／低いまま漂い、
    // 期間全体が偏って「調子の波」というデータにならない
    condition = clamp(condition + (0.5 - condition) * 0.12 + (random() - 0.5) * 0.28, 0.05, 0.95);

    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 何も記録しない日。調子が悪いほど起きやすい
    if (random() < (isWeekend ? 0.28 : 0.12) + (1 - condition) * 0.18) {
      days.push({ date: toDateString(date), condition, tasks: [] });
      continue;
    }

    // 調子がいい日は多めに積む。たまに詰め込みすぎる日を混ぜる
    let count = 1 + Math.floor(condition * 3 + random() * 1.5);
    if (random() < 0.06) count += 3;

    const tasks = [];
    for (let t = 0; t < count; t++) {
      const roll = random();
      // 詰め込んだ日ほど終わらない
      const completionBias = condition * 0.9 + 0.15 - Math.max(0, count - 4) * 0.12;
      const status =
        roll < completionBias ? "done" : roll < completionBias + 0.2 ? "partial" : "todo";
      tasks.push({ status });
    }
    days.push({ date: toDateString(date), condition, tasks });
  }
  return days;
}

function scoreFor(condition, status) {
  // 調子を主、完了状況を従として効かせる。1〜5 が全部出る幅にしておかないと、
  // Phase 2 で「落ちている週」を検出できるかの確認材料にならない
  const base = condition * 3.6 + 1.1;
  const bonus = status === "done" ? 0.6 : status === "partial" ? -0.4 : -0.9;
  return clamp(Math.round(base + bonus + (random() - 0.5) * 1.6), 1, 5);
}

function tagFor(score) {
  if (score >= 4) return random() < 0.75 ? pick(["達成感", "集中"]) : pick(TAGS);
  if (score <= 2) return random() < 0.75 ? pick(["不安", "焦り", "疲労"]) : pick(TAGS);
  return random() < 0.5 ? pick(TAGS) : null;
}

function freeTextFor(score) {
  const band = score >= 4 ? "high" : score <= 2 ? "low" : "mid";
  const text = pick(FREE_TEXTS[band]);
  return text === "" ? null : text;
}

// ---------------------------------------------------------------- 実行

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signIn() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  });
  if (error) fail(`ログインに失敗しました: ${error.message}`);
  console.log(`ログイン: ${data.user.email}（${data.user.id}）`);
  return data.user.id;
}

async function clean(userId) {
  if (!hasFlag("yes")) {
    fail("--clean は取り消せません。実行するなら --yes も付けてください。");
  }
  // goals を消せば sub_goals → tasks → emotion_logs まで cascade で消える
  const { data, error } = await supabase.from("goals").delete().eq("user_id", userId).select("id");
  if (error) fail(`削除に失敗しました: ${error.message}`);
  console.log(`削除しました: 大目標 ${data.length} 件（配下のタスク・感情ログも連鎖削除）`);
}

async function seed(userId) {
  const { data: existing } = await supabase.from("goals").select("id").eq("user_id", userId);
  if (existing && existing.length > 0) {
    fail(
      `このアカウントには既に大目標が ${existing.length} 件あります。` +
        "重複を避けるため、先に --clean --yes で消してから実行してください。",
    );
  }

  // --- ゴールツリー
  const subGoalIds = [];
  for (const goalSpec of GOAL_TREE) {
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .insert({ user_id: userId, title: goalSpec.title })
      .select()
      .single();
    if (goalError) fail(`大目標の作成に失敗しました: ${goalError.message}`);

    for (const subSpec of goalSpec.subGoals) {
      const { data: subGoal, error: subError } = await supabase
        .from("sub_goals")
        .insert({
          goal_id: goal.id,
          title: subSpec.title,
          is_provisional: false,
          achieved_at: subSpec.achieved ? new Date().toISOString() : null,
        })
        .select()
        .single();
      if (subError) fail(`中目標の作成に失敗しました: ${subError.message}`);
      subGoalIds.push({ id: subGoal.id, tasks: subSpec.tasks, achieved: subSpec.achieved });
    }
  }
  console.log(`ゴールツリー: 大目標 ${GOAL_TREE.length} 件 / 中目標 ${subGoalIds.length} 件`);

  // --- タスク（達成済みの中目標にはタスクを足さない。アプリの挙動と揃える）
  const activeSubGoals = subGoalIds.filter((s) => !s.achieved);
  const days = generateDays(weeks);
  const taskRows = [];
  // insert().select() の返却順は保証されないため、日付から調子を引けるようにしておく
  const conditionByDate = new Map(days.map((day) => [day.date, day.condition]));

  for (const day of days) {
    for (const task of day.tasks) {
      const subGoal = pick(activeSubGoals);
      taskRows.push({
        sub_goal_id: subGoal.id,
        title: pick(subGoal.tasks),
        status: task.status,
        date: day.date,
      });
    }
  }

  const inserted = [];
  for (let i = 0; i < taskRows.length; i += 500) {
    const { data, error } = await supabase
      .from("tasks")
      .insert(taskRows.slice(i, i + 500))
      .select("id, date, status");
    if (error) fail(`タスクの作成に失敗しました: ${error.message}`);
    inserted.push(...data);
  }
  console.log(`タスク: ${inserted.length} 件（${weeks} 週間分）`);

  // --- 感情ログ（着手したタスクのみ。記録し忘れも再現する）
  const logRows = [];
  for (const task of inserted) {
    if (task.status === "todo") continue;
    if (random() < 0.15) continue; // 記録し忘れ

    const score = scoreFor(conditionByDate.get(task.date) ?? 0.5, task.status);
    logRows.push({
      task_id: task.id,
      score,
      tag: tagFor(score),
      free_text: freeTextFor(score),
    });
  }

  for (let i = 0; i < logRows.length; i += 500) {
    const { error } = await supabase.from("emotion_logs").insert(logRows.slice(i, i + 500));
    if (error) fail(`感情ログの作成に失敗しました: ${error.message}`);
  }
  console.log(`感情ログ: ${logRows.length} 件`);
}

const userId = await signIn();
if (hasFlag("clean")) {
  await clean(userId);
} else {
  await seed(userId);
  console.log("完了しました。アプリにテストアカウントでログインして確認してください。");
}
await supabase.auth.signOut();
