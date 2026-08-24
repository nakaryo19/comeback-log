/**
 * ランディングページ（サイトのトップ）を組み立てる。
 *
 * このページは **App Store Connect のサポートURLを兼ねる**（リリース計画 C4）。
 * サポートURLは「利用者が困ったときに連絡先へたどり着けること」が要件なので、
 * 宣伝文よりも先に、問い合わせ先が確実に見つかることを優先している。
 * セクションを削るときも「サポート」だけは残すこと。
 *
 * 法務ページ（build-legal.mjs）と同じ dist-legal/ に出力し、同じ
 * プレースホルダ機構（{{...}}）を使う。連絡先メールアドレスと運営者名は
 * 本リポジトリに書かない（docs/legal/README.md「プレースホルダの扱い」）。
 *
 * **書ける機能だけを書くこと。** 未実装の機能を載せると、Apple の審査で
 * 「説明と挙動が違う」と扱われるうえ、利用者への約束としても不誠実になる。
 * 現在の記述は Phase 1（目標ツリー・タスク・感情ログ）と
 * Phase 2（ヒートマップ・週次サマリー・タグ推移）の実装済み範囲に対応する。
 * 公開プロフィール（Phase 3）は未実装なので触れていない。
 */

const CONTENT = {
  tagline: "うまくいかなかった日も、記録に残す。",
  lead:
    "目標に向けた毎日のタスクと、そのときの気持ちを一緒に記録するアプリです。" +
    "続けた記録がたまると、自分がどんなときに動けて、どんなときに止まりやすいのかが見えてきます。",
  status: "iOS 版を準備中です。公開までもうしばらくお待ちください。",

  audience: {
    title: "こんなときに",
    lead: "一度うまくいかなかったことに、もう一度向き合っている人のために作りました。",
    items: [
      "浪人・再受験で、長い期間を自分で管理している",
      "資格や語学の勉強を、仕事と並行して続けている",
      "キャリアを組み立て直している途中で、進み具合が見えにくい",
    ],
  },

  features: {
    title: "できること",
    items: [
      {
        title: "目標を、今日やることまで分解する",
        body:
          "大きな目標の下に中目標を置き、その下に日々のタスクを並べます。" +
          "並行している目標は分けて管理できるので、どれが進んでいてどれが止まっているかが一目で分かります。",
      },
      {
        title: "タスクに、そのときの気持ちを添える",
        body:
          "記録は 5 段階のスコアから。余裕があればタグと一言を足せます。" +
          "毎日きちんと書くことを求めない設計なので、調子が出ない日でも記録が途切れにくくなっています。",
      },
      {
        title: "実績と気持ちを、同じ時間軸で見る",
        body:
          "カレンダー形式の振り返り、週ごとのまとめ、タグの移り変わりを用意しています。" +
          "気づきを提示するのではなく、並べて見せるところまでが役割です。",
      },
    ],
  },

  principles: {
    title: "大事にしていること",
    items: [
      {
        title: "記録を AI に渡さない",
        body:
          "振り返りの表示はすべて、端末の中の計算と決まった文面で作っています。" +
          "外部の AI サービスに記録を送る処理は入れていません。",
      },
      {
        title: "気持ちの記録を外に出さない",
        body:
          "スコア・タグ・自由記述は、外部サービスへの送信も、他の利用者への公開もしません。" +
          "公開できる情報とは、データベースの設計の段階で分けてあります。",
      },
      {
        title: "無料で使える",
        body: "広告はありません。課金もありません。使うために支払いが必要になる箇所はありません。",
      },
    ],
  },

  support: {
    title: "サポート・お問い合わせ",
    body:
      "使い方が分からないとき、うまく動かないとき、アカウントやデータの削除を希望されるときは、" +
      "下記のメールアドレスまでご連絡ください。数日以内に返信します。",
    note: "不具合のご連絡では、お使いの端末とOSのバージョン、どの画面で起きたかを添えていただけると助かります。",
  },

  faq: {
    title: "よくある質問",
    items: [
      {
        q: "書いた内容が他の人に見られることはありますか。",
        a: "ありません。記録はご自身のアカウントからのみ参照できます。他の利用者に公開する機能は用意していません。",
      },
      {
        q: "記録したデータを取り出せますか。",
        a: "アプリの設定画面から、ご自身の記録をまとめて書き出せます。",
      },
      {
        q: "アカウントを削除するとデータはどうなりますか。",
        a: "アプリの設定画面から削除できます。削除するとタスクと記録も消え、元に戻すことはできません。",
      },
      {
        q: "毎日書かないと意味がありませんか。",
        a: "そのようには作っていません。書けた日の分だけを並べて見せる作りなので、間があいても記録は続けられます。",
      },
    ],
  },
};

/**
 * 配色は lib/theme.ts の primary / primaryDark に合わせる。
 * アプリを開いたときに色が変わって見えないようにするため。
 * 法務ページ側の無彩色とは意図的に変えている（あちらは注意を引く理由がない）。
 */
export const LP_STYLE = `
.lp { max-width: 46rem; margin: 0 auto; }
.lp-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 3rem; }
.lp-header img { width: 44px; height: 44px; border-radius: 10px; }
.lp-header span { font-size: 1.05rem; font-weight: 600; }
.hero h1 { font-size: 1.9rem; line-height: 1.5; margin: 0 0 1rem; letter-spacing: 0.01em; }
.hero .lead { font-size: 1rem; color: var(--muted); margin: 0 0 1.5rem; }
.status {
  display: inline-block; padding: 0.5rem 0.9rem; border-radius: 999px;
  background: var(--brand-muted); color: var(--brand); font-size: 0.85rem;
}
.lp section { margin-top: 3.5rem; }
.lp section > h2 { font-size: 1.15rem; margin: 0 0 1rem; padding: 0; border: none; }
.section-lead { color: var(--muted); font-size: 0.95rem; margin: 0 0 1.25rem; }
.cards { display: grid; gap: 1rem; }
@media (min-width: 40rem) { .cards { grid-template-columns: repeat(3, 1fr); } }
.card { border: 1px solid var(--line); border-radius: 12px; padding: 1.1rem 1.2rem; }
.card h3 { font-size: 0.95rem; margin: 0 0 0.5rem; color: var(--fg); }
.card p { font-size: 0.9rem; color: var(--muted); margin: 0; line-height: 1.85; }
.plain-list { list-style: none; padding: 0; margin: 0; }
.plain-list li { padding-left: 1.1rem; position: relative; }
.plain-list li::before { content: "—"; position: absolute; left: 0; color: var(--brand); }
.support { border: 1px solid var(--brand-line); border-radius: 12px; padding: 1.4rem 1.4rem 1.5rem; }
.support p { margin: 0 0 1rem; }
.support .contact { font-size: 1.05rem; font-weight: 600; }
.support .note { font-size: 0.85rem; color: var(--muted); margin: 0; }
.faq dt { font-weight: 600; font-size: 0.95rem; margin-top: 1.4rem; }
.faq dd { margin: 0.4rem 0 0; color: var(--muted); font-size: 0.92rem; }
.doc-links { list-style: none; padding: 0; margin: 0.6rem 0 0; display: flex; gap: 1.25rem; flex-wrap: wrap; }
`;

/** ライト／ダーク双方でトークンを定義する。片方だけだと配色が抜ける */
export const LP_TOKENS = `
:root { --brand:#4338CA; --brand-muted:#EEF2FF; --brand-line:#C7D2FE; }
@media (prefers-color-scheme: dark) {
  :root { --brand:#A5B4FC; --brand-muted:#1e2130; --brand-line:#3b3f57; }
}
`;

function card({ title, body }, escapeHtml) {
  return `<div class="card"><h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p></div>`;
}

/**
 * @param {object} deps
 * @param {(text: string) => string} deps.escapeHtml
 * @param {string} deps.contactEmail 問い合わせ先。サポートURLの要件の中心
 * @param {{ output: string, title: string }[]} deps.pages フッタに並べる法務ページ
 * @param {string} deps.operatorName
 */
export function renderLandingPage({ escapeHtml, contactEmail, pages, operatorName }) {
  const e = escapeHtml;
  const c = CONTENT;

  const docLinks = pages
    .map((p) => `<li><a href="${e(p.output)}">${e(p.title)}</a></li>`)
    .join("\n");

  return `<div class="lp">
<div class="lp-header"><img src="icon.png" alt=""><span>挽回ログ</span></div>

<div class="hero">
<h1>${e(c.tagline)}</h1>
<p class="lead">${e(c.lead)}</p>
<p><span class="status">${e(c.status)}</span></p>
</div>

<section>
<h2>${e(c.audience.title)}</h2>
<p class="section-lead">${e(c.audience.lead)}</p>
<ul class="plain-list">
${c.audience.items.map((item) => `<li>${e(item)}</li>`).join("\n")}
</ul>
</section>

<section>
<h2>${e(c.features.title)}</h2>
<div class="cards">
${c.features.items.map((item) => card(item, e)).join("\n")}
</div>
</section>

<section>
<h2>${e(c.principles.title)}</h2>
<div class="cards">
${c.principles.items.map((item) => card(item, e)).join("\n")}
</div>
</section>

<section id="support">
<h2>${e(c.support.title)}</h2>
<div class="support">
<p>${e(c.support.body)}</p>
<p class="contact"><a href="mailto:${e(contactEmail)}">${e(contactEmail)}</a></p>
<p class="note">${e(c.support.note)}</p>
</div>
</section>

<section class="faq">
<h2>${e(c.faq.title)}</h2>
<dl>
${c.faq.items.map((item) => `<dt>${e(item.q)}</dt>\n<dd>${e(item.a)}</dd>`).join("\n")}
</dl>
</section>

<section>
<h2>各種文書</h2>
<ul class="doc-links">
${docLinks}
</ul>
<p class="note" style="color: var(--muted); font-size: 0.85rem;">提供者：${e(operatorName)}</p>
</section>
</div>`;
}
