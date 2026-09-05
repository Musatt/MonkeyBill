import js from "@eslint/js";

/**
 * 這份設定的重點只有一個：抓出「用了但沒 import／沒宣告」的名字。
 *
 * Vite 的 build 不會檢查這個——曾經有一次 import 漏掉（isPickable），
 * build 完全正常，但一進到那個畫面就 ReferenceError、整頁空白。
 * 所以 no-undef 要當成錯誤擋在 CI。
 */
export default [
  js.configs.recommended,
  {
    files: ["src/**/*.{js,jsx,mjs}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: "readonly",
        document: "readonly",
        localStorage: "readonly",
        navigator: "readonly",
        fetch: "readonly",
        Response: "readonly",
        Blob: "readonly",
        URL: "readonly",
        crypto: "readonly",
        TextEncoder: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        console: "readonly",
        performance: "readonly",
        PointerEvent: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLSelectElement: "readonly",
        Uint8Array: "readonly",
        process: "readonly",
        ResizeObserver: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      // 沒裝 react plugin，eslint 看不懂 JSX 裡的元件使用，會把所有元件匯入都誤報成沒用到。
      // 未使用匯入本來就有自己的掃描腳本在管，這裡關掉免得雜訊蓋掉真正的錯誤。
      "no-unused-vars": "off",
      // 註解裡的全形空白是中文排版正常會有的
      "no-irregular-whitespace": ["error", { skipComments: true, skipStrings: true, skipTemplates: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
