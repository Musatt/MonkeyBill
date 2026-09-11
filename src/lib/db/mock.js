/**
 * 本機開發用的假資料庫——只在 `npm run dev` 時用，正式網站不會載入。
 * 資料存在瀏覽器的 localStorage，測試怎麼亂搞都碰不到正式帳本。
 *
 * 刻意模仿 Firebase 的行為：
 *   ・存進去時一樣會吃掉空陣列、空物件、null（用同一個 simulateFirebaseStore）
 *     → 「欄位被 Firebase 吃掉」的 bug 在本機就會現形
 *   ・開兩個分頁，一邊記帳另一邊會馬上跳出來（模擬即時推送）
 *
 * 模擬不了的：真實網路延遲造成的時序問題。
 * 手冊的教訓——「假資料庫測流程、真資料庫測時序」，兩種都要做。
 *
 * 在 DevTools 的 console 打 localStorage.setItem("__dev_mock_fail_write__", "1")
 * 可以模擬寫入失敗，測「還沒存到雲端」的提示。
 */
import { applyUpdates, simulateFirebaseStore } from "../fbShape.js";

const KEY = "__dev_mock_ledger__";
const LEGACY_KEY = "__dev_mock_supabase__"; // 之前 Supabase 假資料庫存的位置，第一次自動搬過來
const FAIL_WRITE = "__dev_mock_fail_write__";
const LATENCY_MS = 80;

function load() {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw && localStorage.getItem(LEGACY_KEY)) {
      raw = localStorage.getItem(LEGACY_KEY);
      const legacy = JSON.parse(raw);
      const { users, groups, projects, expenses } = legacy.data || legacy;
      // 當成「剛存進 Firebase」處理，空陣列等等一樣被吃掉，跟真的一致
      raw = JSON.stringify(simulateFirebaseStore({ users, groups, projects, expenses }) || {});
      localStorage.setItem(KEY, raw);
    }
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const listeners = new Set();
const emit = () => {
  const d = load();
  listeners.forEach((fn) => fn(d && Object.keys(d).length ? d : null));
};

// 別的分頁寫入時 localStorage 會發 storage 事件，這裡轉成「即時推送」
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) emit();
  });
}

export function subscribeLedger(onData) {
  const fn = (d) => onData(d);
  listeners.add(fn);
  const t = setTimeout(() => fn(load()), LATENCY_MS);
  return () => {
    clearTimeout(t);
    listeners.delete(fn);
  };
}

export function subscribeConnection(onChange) {
  const t = setTimeout(() => onChange(true), LATENCY_MS);
  return () => clearTimeout(t);
}

export async function writeUpdates(updates) {
  await new Promise((r) => setTimeout(r, LATENCY_MS));
  if (localStorage.getItem(FAIL_WRITE)) {
    console.warn("[dev] 模擬寫入失敗");
    throw new Error("PERMISSION_DENIED（模擬）");
  }
  const next = applyUpdates(load() || {}, updates);
  localStorage.setItem(KEY, JSON.stringify(next));
  emit();
}

console.log("[dev] 使用本機假資料庫（localStorage）——正式帳本不會被動到");
