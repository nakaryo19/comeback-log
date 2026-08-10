/**
 * saveTextFile の分岐テスト。
 *
 * Web とネイティブで保存の意味が違い、どちらもブラウザ／端末の API に触るため、
 * 画面側のテストでは saveFile ごとモックされていて経路が踏まれない。ここで直接押さえる。
 *
 * document / Blob / URL は jsdom に頼らず自前で差し替える。この関数が使うのは
 * ごく一部の API だけで、環境を切り替えるより何を呼んでいるかを明示するほうが読みやすい。
 */
// import は巻き上げられてモック工場より先に走るため、工場の中で完結させる。
// 外側の変数を参照すると、初期化前に読まれて undefined になる。
//
// react-native は実物を残して Platform だけ差し替える。丸ごと差し替えると
// expo-modules-core がネイティブモジュールを見つけられず、テスト終了後に警告を出す。
// jest は --ci でこれを失敗として扱う（実際に CI を落とした）。
jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  const platform = { OS: "ios" };
  // Proxy で Platform だけ差し替える。オブジェクトを展開すると
  // ProgressBarAndroid や SafeAreaView の非推奨ゲッターまで踏んでしまう
  return new Proxy(actual, {
    get: (target, prop) => (prop === "Platform" ? platform : Reflect.get(target, prop)),
  });
});

jest.mock("expo-sharing", () => ({
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock("expo-file-system", () => {
  const create = jest.fn();
  const write = jest.fn();
  const remove = jest.fn();
  return {
    Paths: { cache: "file:///cache/" },
    File: class {
      uri: string;
      constructor(_dir: string, fileName: string) {
        this.uri = `file:///cache/${fileName}`;
      }
      create(options: unknown) {
        create(options);
      }
      write(content: string) {
        write(content);
      }
      delete() {
        remove();
      }
    },
    // テストから呼び出しを覗くための口
    __mocks: { create, write, remove },
  };
});

import { saveTextFile } from "../saveFile";

const mockPlatform = jest.requireMock("react-native").Platform as { OS: string };
const { shareAsync: mockShareAsync, isAvailableAsync: mockIsAvailableAsync } =
  jest.requireMock("expo-sharing") as {
    shareAsync: jest.Mock;
    isAvailableAsync: jest.Mock;
  };
const {
  create: mockCreate,
  write: mockWrite,
  remove: mockDelete,
} = (jest.requireMock("expo-file-system") as { __mocks: Record<string, jest.Mock> }).__mocks;

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = "ios";
  mockIsAvailableAsync.mockResolvedValue(true);
  mockShareAsync.mockResolvedValue(undefined);
});

describe("Web", () => {
  const anchor = { href: "", download: "", click: jest.fn() };
  let originalDocument: unknown;

  beforeEach(() => {
    mockPlatform.OS = "web";
    anchor.href = "";
    anchor.download = "";

    originalDocument = (globalThis as Record<string, unknown>).document;
    (globalThis as Record<string, unknown>).document = {
      createElement: jest.fn(() => anchor),
      body: { appendChild: jest.fn(), removeChild: jest.fn() },
    };
    (globalThis as Record<string, unknown>).Blob = jest.fn(function (
      this: Record<string, unknown>,
      parts: string[],
      options: { type: string },
    ) {
      this.parts = parts;
      this.type = options.type;
    });
    (globalThis as Record<string, unknown>).URL = {
      createObjectURL: jest.fn(() => "blob:fake"),
      revokeObjectURL: jest.fn(),
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).document = originalDocument;
  });

  test("ダウンロードとして保存し、saved を返す", async () => {
    const outcome = await saveTextFile("comeback-log-2026-08-10.csv", "日付,タスク", "csv");

    expect(outcome).toBe("saved");
    expect(anchor.download).toBe("comeback-log-2026-08-10.csv");
    expect(anchor.click).toHaveBeenCalled();
    // 解放しないとページを閉じるまでメモリに残る
    expect(
      (globalThis as unknown as { URL: { revokeObjectURL: jest.Mock } }).URL.revokeObjectURL,
    ).toHaveBeenCalledWith("blob:fake");
  });

  test("Web では共有シートを使わない", async () => {
    await saveTextFile("a.json", "{}", "json");
    expect(mockShareAsync).not.toHaveBeenCalled();
  });
});

describe("ネイティブ", () => {
  test("一時ファイルを書いて共有シートに渡し、shared を返す", async () => {
    const outcome = await saveTextFile("comeback-log-2026-08-10.csv", "日付,タスク", "csv");

    expect(outcome).toBe("shared");
    expect(mockWrite).toHaveBeenCalledWith("日付,タスク");
    expect(mockShareAsync).toHaveBeenCalledWith(
      "file:///cache/comeback-log-2026-08-10.csv",
      expect.objectContaining({
        mimeType: expect.stringContaining("text/csv"),
        // iOS の共有シートは UTI を見て渡せるアプリを決める
        UTI: "public.comma-separated-values-text",
      }),
    );
  });

  test("JSON では JSON 用の型情報を渡す", async () => {
    await saveTextFile("a.json", "{}", "json");

    expect(mockShareAsync).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ mimeType: "application/json", UTI: "public.json" }),
    );
  });

  test("同じ名前のファイルがあっても上書きできるようにする", async () => {
    // exportFileName は日付までしか入れないため、同じ日に2回書き出すと衝突する
    await saveTextFile("a.csv", "x", "csv");
    expect(mockCreate).toHaveBeenCalledWith({ overwrite: true });
  });

  test("共有が済んだら一時ファイルを消す", async () => {
    // 感情ログを含むファイルを端末に残さない（CLAUDE.md）
    await saveTextFile("a.csv", "x", "csv");
    expect(mockDelete).toHaveBeenCalled();
  });

  test("共有が失敗しても一時ファイルを消す", async () => {
    mockShareAsync.mockRejectedValue(new Error("失敗"));

    await expect(saveTextFile("a.csv", "x", "csv")).rejects.toThrow("失敗");
    expect(mockDelete).toHaveBeenCalled();
  });

  test("一時ファイルを消せなくても、書き出し自体は成功として扱う", async () => {
    mockDelete.mockImplementation(() => {
      throw new Error("消せない");
    });

    await expect(saveTextFile("a.csv", "x", "csv")).resolves.toBe("shared");
  });

  test("共有機能が使えない端末では理由を伝えて中断する", async () => {
    mockIsAvailableAsync.mockResolvedValue(false);

    await expect(saveTextFile("a.csv", "x", "csv")).rejects.toThrow("共有機能を利用できない");
    expect(mockWrite).not.toHaveBeenCalled();
  });
});
