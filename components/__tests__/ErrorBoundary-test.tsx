import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ErrorBoundary } from "../ErrorBoundary";

/** 描画時に例外を投げるかどうかを外から切り替えられる子 */
function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Something went wrong in English");
  return <Text>正常な画面</Text>;
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  // React は境界が拾った例外も別途 console.error に出す。__DEV__ では
  // ErrorBoundary 自身も出す。--ci ではテスト後のログが失敗扱いになるため黙らせる
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

test("例外が無ければ子をそのまま描画する", async () => {
  await render(
    <ErrorBoundary>
      <Boom shouldThrow={false} />
    </ErrorBoundary>,
  );

  expect(screen.getByText("正常な画面")).toBeTruthy();
});

test("描画中の例外を受け止めて代替画面を出す", async () => {
  await render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  expect(screen.getByText("画面を表示できませんでした")).toBeTruthy();
  // 白画面にならないことがこの部品の目的。押せる復帰手段が要る
  expect(screen.getByText("もう一度読み込む")).toBeTruthy();
});

test("本番では英語の例外文を利用者に見せない", async () => {
  // テスト環境の __DEV__ は true。そのままだと開発用の詳細表示が出てしまい、
  // 本番の見え方を確かめたことにならないので、ここだけ本番相当に倒す
  // 型定義上 __DEV__ はグローバル変数であって globalThis のプロパティではないため、
  // 書き換えにはキャストが要る
  const g = global as unknown as { __DEV__: boolean };
  const dev = g.__DEV__;
  g.__DEV__ = false;
  try {
    await render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
  } finally {
    g.__DEV__ = dev;
  }

  expect(screen.queryByText(/Something went wrong/)).toBeNull();
  expect(screen.getByText("画面を表示できませんでした")).toBeTruthy();
});

test("開発時は原因の手がかりを出す", async () => {
  // 本番で隠すぶん、開発中に握りつぶすと原因追跡ができなくなる
  await render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  expect(screen.getByText("Something went wrong in English")).toBeTruthy();
});

test("保存済みデータが消えないことを伝える", async () => {
  // 記録を積み上げるアプリなので、「今までの記録が消えたのでは」という不安が
  // 一番大きい。ここが落ちると代替画面の役目を果たさない
  await render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  expect(screen.getByText(/保存済みの記録が消えることはありません/)).toBeTruthy();
});

test("もう一度読み込むと、原因が解消していれば復帰する", async () => {
  const { rerender } = await render(
    <ErrorBoundary>
      <Boom shouldThrow />
    </ErrorBoundary>,
  );

  // 例外の原因を取り除いてから再試行する。取り除かずに押しても
  // 同じ例外で戻るだけなので、復帰できることを確かめるにはこの順序が要る
  await rerender(
    <ErrorBoundary>
      <Boom shouldThrow={false} />
    </ErrorBoundary>,
  );
  await fireEvent.press(screen.getByText("もう一度読み込む"));

  expect(screen.getByText("正常な画面")).toBeTruthy();
});
