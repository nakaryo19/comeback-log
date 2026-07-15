// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // マウント時のデータ取得（useEffect + setState）パターンを許容する。
      // 検出自体は warn として残し、新規コードでの多用は避けること。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
