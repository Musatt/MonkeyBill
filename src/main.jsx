import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

// 本機開發時用假資料庫，正式網站用 Firebase——切換邏輯在 src/lib/db/index.js。

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
