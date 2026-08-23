import { CATEGORIES, CURRENCY_DECIMALS } from "../constants.js";

export function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 本地時區的今天。不能用 toISOString()——那是 UTC，台灣時間凌晨 0~8 點會算成前一天。
export function todayStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nowHHMM() {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(Math.floor(d.getMinutes() / 5) * 5).padStart(2, "0");
  return { hour: h, minute: m };
}

export function decimalsOf(cur) {
  return CURRENCY_DECIMALS[cur] !== undefined ? CURRENCY_DECIMALS[cur] : 2;
}

// 專案內所有主幣別金額統一用結算位數顯示，項目列表、統計、結算才不會出現
// 「一筆一筆加起來跟總額對不上」的情形。
export function projectDecimals(project) {
  return project?.settlementDecimals ?? 0;
}

function groupDigits(s) {
  const parts = s.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

// 負號放在幣別前面（-TWD 250），跟加號的位置一致。
export function formatMoney(amount, currency, decimalsOverride) {
  const d = decimalsOverride !== undefined ? decimalsOverride : decimalsOf(currency);
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${currency} —`;
  const body = groupDigits(Math.abs(n).toFixed(d));
  return `${n < 0 ? "-" : ""}${currency} ${body}`;
}

// 正數強制帶 +，用在餘額/淨額這種需要一眼看出方向的地方。
export function formatSigned(amount, currency, decimalsOverride) {
  const n = Number(amount);
  const s = formatMoney(n, currency, decimalsOverride);
  return Number.isFinite(n) && n > 0 ? `+${s}` : s;
}

export function categoryOf(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// 群組內是否已有同名成員（trim 後完全相同）。含已軟刪除的成員，
// 因為舊紀錄還是用名字顯示，同名會造成歷史紀錄看不出是誰。
// 回傳 null / 該成員物件，讓呼叫端可以區分「同名的是現役成員」還是「同名的已被刪除、可以復活」。
export function findMemberByName(members, name, excludeId) {
  const trimmed = name.trim();
  return members.find((m) => m.id !== excludeId && m.name === trimmed) || null;
}

// 給「最後編輯」用的時間戳記，例如 2026-08-22 19:55
export function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${todayStr(d)} ${hh}:${mm}`;
}
