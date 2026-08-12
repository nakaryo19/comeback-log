import Constants from "expo-constants";

/**
 * プライバシーポリシー・利用規約の公開URL。
 *
 * 文面は `docs/legal/` にあり、Cloudflare Pages から配信する
 * （`scripts/build-legal.mjs`）。アプリはそのページへ送るだけで、
 * 本文をアプリ内に二重に持たない。二重に持つと、文面を直したときに
 * 配信側とアプリ側で食い違い、どちらが有効な規約か分からなくなる。
 *
 * ★リリース前に `app.json` の `extra.legalBaseUrl` を設定すること。
 * 未設定の間はリンクを表示しない（存在しないURLへ送るくらいなら出さない）。
 * App Store 提出時にはプライバシーポリシーURLが必須のため、
 * 未設定のまま提出することはありえない（リリース計画 §2 A3）。
 */
const baseUrl: string | undefined = Constants.expoConfig?.extra?.legalBaseUrl || undefined;

export type LegalLink = { label: string; url: string };

/** 公開URLが未設定なら空配列。呼び出し側は件数を見て表示を決める */
export function legalLinks(): LegalLink[] {
  if (!baseUrl) return [];

  // 拡張子なしが正規URL。Cloudflare Pages は `.html` 付きを 308 で
  // 落とした形へ飛ばすため、付けるとリダイレクトを1回挟むことになる
  const origin = baseUrl.replace(/\/$/, "");
  return [
    { label: "プライバシーポリシー", url: `${origin}/privacy-policy` },
    { label: "利用規約", url: `${origin}/terms` },
  ];
}
