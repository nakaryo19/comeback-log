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
