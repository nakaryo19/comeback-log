import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";
import { AboutScreen } from "../AboutScreen";
import { legalLinks } from "../../../lib/legalLinks";

jest.mock("../../../lib/legalLinks", () => ({ legalLinks: jest.fn() }));

const mockLegalLinks = legalLinks as jest.MockedFunction<typeof legalLinks>;

const LINKS = [
  { label: "プライバシーポリシー", url: "https://example.test/privacy-policy.html" },
  { label: "利用規約", url: "https://example.test/terms.html" },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockLegalLinks.mockReturnValue(LINKS);
});

test("ポリシーと規約への導線を出す", async () => {
  await render(<AboutScreen onBack={jest.fn()} />);

  expect(screen.getByText("プライバシーポリシー")).toBeTruthy();
  expect(screen.getByText("利用規約")).toBeTruthy();
});

test("押すと外部ブラウザで開く", async () => {
  const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
  await render(<AboutScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("プライバシーポリシー"));

  expect(openURL).toHaveBeenCalledWith("https://example.test/privacy-policy.html");
});

test("公開URLが未設定なら、リンクを出さない", async () => {
  // 存在しないURLへ送るくらいなら、導線ごと出さない
  mockLegalLinks.mockReturnValue([]);
  await render(<AboutScreen onBack={jest.fn()} />);

  expect(screen.queryByText("プライバシーポリシー")).toBeNull();
  // ライセンス表示はURLに依存しないので、こちらは常に出る
  expect(screen.getByText("オープンソースライセンス")).toBeTruthy();
});

test("ライセンス一覧へ遷移できる", async () => {
  await render(<AboutScreen onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("オープンソースライセンス"));

  expect(await screen.findByText(/このアプリは、以下のオープンソースソフトウェア/)).toBeTruthy();
});
