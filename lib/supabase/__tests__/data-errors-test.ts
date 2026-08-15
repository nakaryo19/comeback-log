import { describeDataError } from "../data-errors";

const FALLBACK = "タスクの追加に失敗しました。";
const NETWORK = "通信に失敗しました。電波の良い場所で、もう一度お試しください。";

let warn: jest.SpyInstance;

beforeEach(() => {
  // 未分類のエラーは __DEV__ で console.warn に出す実装。
  // --ci ではテスト後のログが失敗扱いになるため黙らせる
  warn = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

test("英語の例外文ではなく、渡した日本語を返す", () => {
  // これが B12 の本体。直す前は英語の原文が画面に出ていた
  const error = new Error('duplicate key value violates unique constraint "tasks_pkey"');

  const message = describeDataError(error, FALLBACK);

  expect(message).toBe(FALLBACK);
  expect(message).not.toContain("duplicate");
});

test("通信エラーは電波の案内に振り替える", () => {
  // 通信失敗だけは利用者が取れる手が違う（場所を変えれば直る）ので分ける
  expect(describeDataError(new Error("Network request failed"), FALLBACK)).toBe(NETWORK);
  expect(describeDataError(new Error("Failed to fetch"), FALLBACK)).toBe(NETWORK);
  expect(describeDataError(new Error("The request timed out"), FALLBACK)).toBe(NETWORK);
});

test("大文字小文字が違っても通信エラーとみなす", () => {
  expect(describeDataError(new Error("NETWORK REQUEST FAILED"), FALLBACK)).toBe(NETWORK);
});

test("Error 以外が投げられても日本語を返す", () => {
  // 直す前はこの経路でだけ日本語が使われていた。逆になっていたのが不具合の原因
  expect(describeDataError("何か文字列", FALLBACK)).toBe(FALLBACK);
  expect(describeDataError(null, FALLBACK)).toBe(FALLBACK);
  expect(describeDataError({ code: "23505" }, FALLBACK)).toBe(FALLBACK);
});

test("操作ごとの文言はそのまま通す", () => {
  // 何に失敗したかを書けるのは呼び出し側だけなので、ここで一律に潰さない
  expect(describeDataError(new Error("boom"), "大目標の削除に失敗しました。")).toBe(
    "大目標の削除に失敗しました。",
  );
});

test("未分類のエラーは開発時にコンソールへ残す", () => {
  // 利用者には出さないぶん、開発中に握りつぶすと原因追跡ができなくなる
  describeDataError(new Error("PGRST116: no rows returned"), FALLBACK);

  expect(warn).toHaveBeenCalled();
  expect(JSON.stringify(warn.mock.calls)).toContain("PGRST116");
});

test("通信エラーはコンソールに出さない", () => {
  // 原因が分かっている経路なので、開発中のノイズにしない
  describeDataError(new Error("Network request failed"), FALLBACK);

  expect(warn).not.toHaveBeenCalled();
});
