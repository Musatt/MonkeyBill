import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages 服務在 https://musatt.github.io/MonkeyBill/ 底下，
// 所以 production build 的資源路徑要帶 repo 名稱。
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/MonkeyBill/" : "/",
  plugins: [react()],
  build: { outDir: "dist", sourcemap: false },
}));
