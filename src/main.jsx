import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 本機開發時把 Supabase 換成 localStorage 假資料，避免測試動到正式資料。
// 要在本機連正式資料庫時，把 .env.local 裡的 VITE_USE_REAL_DB 設成 1。
if (import.meta.env.DEV && import.meta.env.VITE_USE_REAL_DB !== "1") {
  const { installMockSupabase } = await import("./devMockSupabase.js");
  installMockSupabase();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
