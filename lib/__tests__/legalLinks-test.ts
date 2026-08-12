/**
 * 公開URLの組み立て。未設定のまま出荷すると、規約が読めないアプリを
 * ストアに出すことになるため、未設定を「空配列」として扱えているかを押さえる。
 */
function loadWith(legalBaseUrl: unknown) {
  let links: typeof import("../legalLinks").legalLinks;
  jest.isolateModules(() => {
    jest.doMock("expo-constants", () => ({
      __esModule: true,
      default: { expoConfig: { extra: { legalBaseUrl } } },
    }));
    links = require("../legalLinks").legalLinks;
  });
  return links!;
}

afterEach(() => {
  jest.resetModules();
  jest.dontMock("expo-constants");
});

test("設定された公開URLから各ページのURLを組み立てる", () => {
  const links = loadWith("https://example.test")();

  expect(links).toEqual([
    { label: "プライバシーポリシー", url: "https://example.test/privacy-policy" },
    { label: "利用規約", url: "https://example.test/terms" },
  ]);
});

test("末尾のスラッシュがあっても二重にならない", () => {
  const links = loadWith("https://example.test/")();
  expect(links[0].url).toBe("https://example.test/privacy-policy");
});

test("未設定なら空配列を返す", () => {
  expect(loadWith(undefined)()).toEqual([]);
});

test("空文字も未設定として扱う", () => {
  // app.json に鍵だけ書いて値を入れ忘れた場合
  expect(loadWith("")()).toEqual([]);
});
