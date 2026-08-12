/**
 * アプリに同梱される OSS のライセンス一覧を生成する。
 *
 * App Store に出すアプリは、バンドルしている OSS の著作権表示を利用者が読める形で
 * 提供する必要がある。MIT・BSD 系はライセンス条文に「著作権表示と許諾表示を
 * 複製物に含めること」が条件として書かれており、これを満たさないと
 * ライセンス違反のまま配布することになる。
 *
 * 実行時には node_modules を読めないため、ビルド時に静的なデータへ落とす。
 *
 * 対象は **本番依存の推移的閉包**（`npm ls --omit=dev --all`）。devDependencies は
 * アプリに同梱されないため含めない。
 *
 * 使い方:
 *   node scripts/build-licenses.mjs      # lib/licenses/licenses.json を再生成
 *   node scripts/build-licenses.mjs --check   # 生成物が最新かを確認する（CI 用）
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(root, "lib", "licenses", "licenses.json");

/** LICENSE 本文として扱うファイル名。大文字小文字と拡張子の揺れを吸収する */
const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt))?$/i;

/**
 * 著作権表示に使う名前。LICENSE ファイルを同梱していないパッケージ向け。
 *
 * npm には `license: "MIT"` と宣言しつつ LICENSE ファイルを持たないパッケージが
 * 一定数ある（本プロジェクトでは70件）。MIT は「著作権表示を複製物に含めること」を
 * 条件にしているため、名称だけでは条件を満たしたことにならない。
 * せめて package.json の author を著作権者として拾う。
 */
function authorName(pkg) {
  const author = pkg.author ?? pkg.maintainers?.[0] ?? pkg.contributors?.[0];
  if (typeof author === "string") return author.replace(/\s*<[^>]*>/, "").trim() || null;
  if (author?.name) return author.name;
  return null;
}

function productionPackagePaths() {
  let output;
  try {
    output = execFileSync("npm", ["ls", "--omit=dev", "--all", "--parseable", "--long=false"], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    // npm ls は peer 依存の警告などでも非ゼロで終わるが、そのときも
    // ツリー自体は標準出力に出ている。一覧が取れているなら続行する
    output = error.stdout ?? "";
    if (!output.includes("/node_modules/")) throw error;
  }

  return [...new Set(output.split("\n").filter((line) => line.includes("/node_modules/")))];
}

function readLicenseText(packageDir) {
  let entries;
  try {
    entries = readdirSync(packageDir);
  } catch {
    return null;
  }

  const fileName = entries.find((entry) => LICENSE_FILE.test(entry));
  if (!fileName) return null;

  try {
    return readFileSync(join(packageDir, fileName), "utf8").trim();
  } catch {
    return null;
  }
}

/** package.json の license 欄。古い形式（オブジェクト／配列）も拾う */
function licenseId(pkg) {
  if (typeof pkg.license === "string") return pkg.license;
  if (pkg.license?.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) {
    return pkg.licenses.map((entry) => entry.type ?? entry).join(" / ");
  }
  return "不明";
}

function collect() {
  const byKey = new Map();

  for (const packageDir of productionPackagePaths()) {
    const manifestPath = join(packageDir, "package.json");
    if (!existsSync(manifestPath)) continue;

    let pkg;
    try {
      pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    if (!pkg.name || pkg.private) continue;

    // 同じパッケージの同じバージョンが複数箇所に入ることがある（重複排除）
    const key = `${pkg.name}@${pkg.version}`;
    if (byKey.has(key)) continue;

    // 条文は重複が多く、まとめれば埋め込んでも軽い（下記 dedupeTexts）。
    // Apache-2.0 のような長文も、ユニークな本文は1つに畳まれるため除外しない
    byKey.set(key, {
      name: pkg.name,
      version: pkg.version ?? "",
      license: licenseId(pkg),
      text: readLicenseText(packageDir),
      author: authorName(pkg),
    });
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * 同一の条文を1つにまとめ、パッケージ側は添字で参照する。
 *
 * 486件の本文のうちユニークは223件しかない（MIT がほとんどで、
 * 著作権者名の行だけが違う）。そのまま並べるとアプリの資産が倍近くになる。
 */
function dedupeTexts(packages) {
  const texts = [];
  const indexByText = new Map();

  const entries = packages.map(({ name, version, license, text, author }) => {
    if (text === null) {
      // 条文が無いパッケージは、著作権者だけでも残す
      return author ? { name, version, license, author } : { name, version, license };
    }

    let index = indexByText.get(text);
    if (index === undefined) {
      index = texts.length;
      indexByText.set(text, index);
      texts.push(text);
    }
    return { name, version, license, text: index };
  });

  return { texts, entries };
}

const collected = collect();
const { texts, entries } = dedupeTexts(collected);
const json = `${JSON.stringify(
  {
    generated_from: "npm ls --omit=dev --all",
    // text は texts の添字。省略されている場合は条文名のみを示す（長文ライセンス）
    texts,
    packages: entries,
  },
  null,
  2,
)}\n`;
const packages = collected;

if (process.argv.includes("--check")) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
  if (current !== json) {
    console.error(
      "lib/licenses/licenses.json が依存関係と一致していません。" +
        "`npm run build:licenses` を実行してコミットしてください。",
    );
    process.exit(1);
  }
  console.log(`ライセンス一覧は最新です（${packages.length} パッケージ）。`);
} else {
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, json);
  console.log(
    `${packages.length} パッケージのライセンスを lib/licenses/licenses.json に出力しました。`,
  );
}
