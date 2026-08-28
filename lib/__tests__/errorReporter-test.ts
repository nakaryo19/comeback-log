import { reportError, setErrorSink, type ErrorReport } from "../errorReporter";

let consoleWarn: jest.SpyInstance;
let received: ErrorReport[];

beforeEach(() => {
  received = [];
  consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
  setErrorSink((report) => received.push(report));
});

afterEach(() => {
  consoleWarn.mockRestore();
  setErrorSink(null);
});

test("文脈とメッセージ、スタックを送信先へ渡す", () => {
  const error = new Error("relation \"tasks\" does not exist");
  reportError("タスクの取得に失敗しました。", error);

  expect(received).toHaveLength(1);
  expect(received[0]).toMatchObject({
    context: "タスクの取得に失敗しました。",
    message: 'relation "tasks" does not exist',
  });
  expect(received[0].stack).toContain("Error");
});

test("Error でない値も記録できる", () => {
  reportError("書き出し", "文字列が投げられた");

  expect(received[0]).toMatchObject({ message: "文字列が投げられた", stack: undefined });
});

test("PostgREST のエラー（Error ではないオブジェクト）から本文とコードを取り出す", () => {
  // これを取りこぼしていたため、本番の error_logs には
  // 2026-08-28 まで "[object Object]" しか残っていなかった
  reportError("登録に失敗しました。", {
    code: "42501",
    message: 'new row violates row-level security policy for table "goals"',
    details: null,
    hint: null,
  });

  expect(received[0].message).toBe(
    '[42501] new row violates row-level security policy for table "goals"',
  );
});

test("details があれば message と併せて残す", () => {
  reportError("保存", { code: "23503", message: "insert violates foreign key", details: "user_id" });

  expect(received[0].message).toBe("[23503] insert violates foreign key / user_id");
});

test("message も details も無いオブジェクトは中身ごと残す", () => {
  // 想定外の形で "[object Object]" に潰れるのを二度と起こさない
  reportError("どこか", { weird: true });

  expect(received[0].message).toBe('{"weird":true}');
});

test("循環参照を含む値でも記録を諦めない", () => {
  const circular: Record<string, unknown> = {};
  circular.self = circular;

  expect(() => reportError("どこか", circular)).not.toThrow();
  expect(received).toHaveLength(1);
});

test("長すぎる本文は打ち切る", () => {
  // DB は一意制約違反などで値をそのまま含めてくる。全文を残す価値は無い
  reportError("保存", new Error("あ".repeat(1000)));

  expect(received[0].message.length).toBeLessThanOrEqual(501);
  expect(received[0].message.endsWith("…")).toBe(true);
});

test("送信先が未設定でも落ちない", () => {
  // 起動直後や、テストのように差し込んでいない環境で呼ばれうる
  setErrorSink(null);

  expect(() => reportError("どこか", new Error("boom"))).not.toThrow();
});

test("送信先が投げても、呼び出し元へは伝播させない", () => {
  // 記録の失敗で画面が壊れたら本末転倒。しかも壊れるのは既に何かが失敗している場面
  setErrorSink(() => {
    throw new Error("送信に失敗");
  });

  expect(() => reportError("どこか", new Error("boom"))).not.toThrow();
});
