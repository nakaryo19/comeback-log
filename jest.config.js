/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  // 各テストファイルの最初の render に React Native のモジュール読み込みコストがまとめて乗り、
  // 既定の5秒ではCIランナー上で足りない（2件目以降は数十msで終わる）。
  // 個々のテストが遅いわけではないため、上限だけを引き上げている。
  testTimeout: 20000,
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg)",
  ],
};
