/**
 * docs/legal/ の Markdown を静的 HTML に変換する（Cloudflare Pages 配信用）。
 *
 * 本体リポジトリを private にしたうえで、法務文書だけを公開URLで配信するための最小の仕組み。
 * App Store 提出にはプライバシーポリシーの公開URLが必須（商用リリース前チェックリスト §1-2）。
 *
 * 依存パッケージを増やしていないのは、対象が3ファイルで、使っている記法が
 * 見出し・段落・箇条書き・番号付き・表・強調・水平線・リンクに限られるため。
 * Markdown ライブラリを1つ入れるより、扱う記法を固定して自前で持つほうが
 * 供給網のリスクも更新の手間も小さい。記法を増やしたくなったら、
 * まず docs/legal/ 側を既存の記法で書けないか検討すること。
 *
 * 使い方:
 *   node scripts/build-legal.mjs            # dist-legal/ に出力
 *   LEGAL_VALUES='{"運営者名":"..."}' node scripts/build-legal.mjs
 *
 * プレースホルダの値は Git に入れない（docs/legal/README.md「プレースホルダの扱い」）。
 * ローカルでは docs/legal/values.local.json、Cloudflare Pages では
 * 環境変数 LEGAL_VALUES（JSON文字列）から読む。
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "docs", "legal");
const outputDir = join(root, "dist-legal");

/**
 * 公開するファイルの明示的な許可リスト。
 *
 * ディレクトリを走査せずここに列挙しているのは、docs/legal/README.md が
 * 未確定事項や社内向けの注意書きを含む内部メモだからである。
 * 走査方式にすると、法務文書を1つ足したときに内部メモまで一緒に公開されうる。
 */
const PAGES = [
  { source: "プライバシーポリシー.md", output: "privacy-policy.html", title: "プライバシーポリシー" },
  { source: "利用規約.md", output: "terms.html", title: "利用規約" },
];

const SITE_TITLE = "挽回ログ";

// ---------------------------------------------------------------- 値の解決

function loadValues() {
  const localPath = join(sourceDir, "values.local.json");

  if (process.env.LEGAL_VALUES) {
    try {
      return JSON.parse(process.env.LEGAL_VALUES);
    } catch (error) {
      throw new Error(`環境変数 LEGAL_VALUES が JSON として読めません: ${error.message}`);
    }
  }
  if (existsSync(localPath)) {
    return JSON.parse(readFileSync(localPath, "utf8"));
  }
  throw new Error(
    "プレースホルダの値が見つかりません。docs/legal/values.local.json を作る" +
      "（docs/legal/values.example.json をコピー）か、環境変数 LEGAL_VALUES に JSON を渡してください。",
  );
}

/**
 * {{...}} を値で置き換える。
 *
 * 埋め忘れは公開してから気づいても遅い（開示請求の宛先が存在しないことになる）ので、
 * 未解決が1つでも残っていればビルドを失敗させる。
 */
function substitute(markdown, values, sourceName) {
  const missing = new Set();
  const filled = markdown.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const value = values[key];
    if (typeof value !== "string" || value.length === 0) {
      missing.add(key);
      return match;
    }
    return value;
  });

  if (missing.size > 0) {
    throw new Error(`${sourceName}: 値が未設定のプレースホルダがあります: ${[...missing].join(", ")}`);
  }
  return filled;
}

// ------------------------------------------------------------ Markdown 変換

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 行内記法。エスケープしてから適用するので、記法そのものは HTML を生めない */
function inline(text) {
  return escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
}

/** 表のセル行 `| a | b |` を分解する */
function tableCells(line) {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableDivider(line) {
  return /^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(line);
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];

  // 開いているリスト。ネストは「番号付きの項目の下にぶら下がる箇条書き」だけを想定する。
  // ネストした ul は親の li の内側に置く必要があるため、li は次の項目が来るまで閉じない
  let listTag = null;
  let nestedOpen = false;
  let itemOpen = false;

  function closeItem() {
    if (nestedOpen) {
      html.push("</ul>");
      nestedOpen = false;
    }
    if (itemOpen) {
      html.push("</li>");
      itemOpen = false;
    }
  }

  function closeList() {
    closeItem();
    if (listTag) {
      html.push(`</${listTag}>`);
      listTag = null;
    }
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (line.trim() === "") {
      closeList();
      continue;
    }

    // 水平線
    if (/^-{3,}\s*$/.test(line)) {
      closeList();
      html.push("<hr>");
      continue;
    }

    // 見出し
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    // 表。ヘッダ行と区切り行が揃っているものだけ表として扱う
    if (line.trim().startsWith("|") && isTableDivider(lines[i + 1] ?? "")) {
      closeList();
      const header = tableCells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(tableCells(lines[i]));
        i += 1;
      }
      i -= 1;

      html.push('<div class="table-scroll"><table>');
      html.push(`<thead><tr>${header.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>`);
      html.push("<tbody>");
      for (const row of rows) {
        html.push(`<tr>${row.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`);
      }
      html.push("</tbody></table></div>");
      continue;
    }

    // 番号付き項目にぶら下がる箇条書き（利用規約 第7条）
    const nested = line.match(/^\s+[-*]\s+(.*)$/);
    if (nested && itemOpen) {
      if (!nestedOpen) {
        html.push("<ul>");
        nestedOpen = true;
      }
      html.push(`<li>${inline(nested[1])}</li>`);
      continue;
    }

    const unordered = line.match(/^[-*]\s+(.*)$/);
    const ordered = line.match(/^\d+\.\s+(.*)$/);
    if (unordered || ordered) {
      const tag = unordered ? "ul" : "ol";
      if (listTag !== tag) {
        closeList();
        html.push(`<${tag}>`);
        listTag = tag;
      } else {
        closeItem();
      }
      html.push(`<li>${inline((unordered ?? ordered)[1])}`);
      itemOpen = true;
      continue;
    }

    closeList();
    html.push(`<p>${inline(line.trim())}</p>`);
  }

  closeList();
  return html.join("\n");
}

// ------------------------------------------------------------------ ページ

/**
 * 配色は落ち着いた無彩色に寄せる。法務文書に注意を引く色を使う理由がなく、
 * 端末のダークモード設定にも合わせる。
 */
const STYLE = `
:root { color-scheme: light dark; --bg:#ffffff; --fg:#1f2328; --muted:#616a75; --line:#e2e5e9; --accent:#4a5568; }
@media (prefers-color-scheme: dark) {
  :root { --bg:#16181c; --fg:#e6e8eb; --muted:#a0a7b0; --line:#2c3037; --accent:#c2cad3; }
}
* { box-sizing: border-box; }
body {
  margin: 0; padding: 2.5rem 1.25rem 5rem; background: var(--bg); color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif;
  line-height: 1.9; font-size: 16px; overflow-wrap: anywhere;
}
main { max-width: 44rem; margin: 0 auto; }
h1 { font-size: 1.5rem; line-height: 1.5; margin: 0 0 1.5rem; }
h2 { font-size: 1.15rem; margin: 2.75rem 0 0.75rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--line); }
h3 { font-size: 1rem; margin: 1.75rem 0 0.5rem; color: var(--muted); }
p, li { font-size: 0.95rem; }
ul, ol { padding-left: 1.4rem; }
li { margin-bottom: 0.4rem; }
li > ul { margin-top: 0.4rem; }
hr { border: none; border-top: 1px solid var(--line); margin: 2rem 0; }
strong { font-weight: 600; }
a { color: var(--accent); }
.table-scroll { overflow-x: auto; margin: 1rem 0; }
table { border-collapse: collapse; width: 100%; min-width: 20rem; font-size: 0.9rem; }
th, td { border: 1px solid var(--line); padding: 0.5rem 0.7rem; text-align: left; vertical-align: top; }
th { background: color-mix(in srgb, var(--line) 45%, transparent); font-weight: 600; }
nav { max-width: 44rem; margin: 0 auto 2rem; font-size: 0.85rem; }
nav a { color: var(--muted); text-decoration: none; }
nav a:hover { text-decoration: underline; }
footer { max-width: 44rem; margin: 4rem auto 0; padding-top: 1.5rem; border-top: 1px solid var(--line); font-size: 0.8rem; color: var(--muted); }
`;

function page({ title, body, showBackLink }) {
  const nav = showBackLink ? '<nav><a href="./">← 挽回ログ</a></nav>' : "";
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} | ${escapeHtml(SITE_TITLE)}</title>
<style>${STYLE}</style>
</head>
<body>
${nav}
<main>
${body}
</main>
<footer>${escapeHtml(SITE_TITLE)}</footer>
</body>
</html>
`;
}

function indexBody() {
  const links = PAGES.map((p) => `<li><a href="${p.output}">${escapeHtml(p.title)}</a></li>`).join("\n");
  return `<h1>挽回ログ</h1>
<p>目標達成までのタスクと、そのときの気持ちを一緒に記録するアプリです。</p>
<h2>各種文書</h2>
<ul>
${links}
</ul>`;
}

// -------------------------------------------------------------------- 実行

function main() {
  const values = loadValues();

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  for (const target of PAGES) {
    const raw = readFileSync(join(sourceDir, target.source), "utf8");
    const filled = substitute(raw, values, target.source);
    const html = page({
      title: target.title,
      body: renderMarkdown(filled),
      showBackLink: true,
    });
    writeFileSync(join(outputDir, target.output), html);
    console.log(`  ${target.source} -> dist-legal/${target.output}`);
  }

  writeFileSync(
    join(outputDir, "index.html"),
    page({ title: "ホーム", body: indexBody(), showBackLink: false }),
  );
  console.log("  index.html");
  console.log(`完了: ${PAGES.length + 1} ページを dist-legal/ に出力しました。`);
}

try {
  main();
} catch (error) {
  console.error(`ビルド失敗: ${error.message}`);
  process.exit(1);
}
