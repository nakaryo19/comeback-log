import { fireEvent, render, screen } from "@testing-library/react-native";
import { OpenSourceLicenses } from "../OpenSourceLicenses";

// 実データは556件あり、テストでは中身の正しさより「3つの分岐が描けるか」を見たい
jest.mock("../../../lib/licenses/licenses.json", () => ({
  texts: ["MIT License\n\nCopyright (c) 2020 実在しない人\n\n以下略"],
  packages: [
    { name: "with-text", version: "1.0.0", license: "MIT", text: 0 },
    { name: "author-only", version: "2.0.0", license: "MIT", author: "Dave Wasmer" },
    { name: "bare", version: "3.0.0", license: "ISC" },
  ],
}));

test("一覧にパッケージ名・バージョン・ライセンス名を出す", async () => {
  await render(<OpenSourceLicenses onBack={jest.fn()} />);

  expect(screen.getByText("with-text")).toBeTruthy();
  expect(screen.getByText("1.0.0 ・ MIT")).toBeTruthy();
});

test("条文を持つパッケージは、押すと全文を出す", async () => {
  await render(<OpenSourceLicenses onBack={jest.fn()} />);

  expect(screen.queryByText(/Copyright \(c\) 2020/)).toBeNull();
  await fireEvent.press(screen.getByText("with-text"));

  expect(screen.getByText(/Copyright \(c\) 2020 実在しない人/)).toBeTruthy();
});

test("条文が無くても、著作権者が分かれば著作権表示を出す", async () => {
  // MIT・BSD は著作権表示を複製物に含めることを条件にしている。
  // ライセンス名だけでは条件を満たしたことにならない
  await render(<OpenSourceLicenses onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("author-only"));

  expect(screen.getByText(/Copyright \(c\) Dave Wasmer/)).toBeTruthy();
});

test("著作権者も分からなければ、ライセンス名だけを示す", async () => {
  await render(<OpenSourceLicenses onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("bare"));

  expect(screen.getByText("ISC の条文に基づいて提供されています。")).toBeTruthy();
});

test("開いている項目は1つだけ", async () => {
  // 全部開けるようにすると、556件の条文が同時に描かれて操作できなくなる
  await render(<OpenSourceLicenses onBack={jest.fn()} />);

  await fireEvent.press(screen.getByText("with-text"));
  await fireEvent.press(screen.getByText("author-only"));

  expect(screen.queryByText(/Copyright \(c\) 2020/)).toBeNull();
  expect(screen.getByText(/Copyright \(c\) Dave Wasmer/)).toBeTruthy();
});
