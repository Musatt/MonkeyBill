/**
 * 登入畫面的名單：排序與搜尋。
 *
 * 不依群組分區——分區會把群組名稱秀給每一個打開網站的人看，私密群組就不私密了。
 */
import { nameKey } from "./names.js";

/**
 * 從 id 讀出真正的建立時間。
 * id 長這樣：mem_mslxu6pb_k3j9a1，中間那段是建立當下的時間（36 進位）。
 * 不用 createdAt 欄位，是因為資料格式升級那次把所有舊帳號的 createdAt 都蓋成同一個時間了，
 * id 裡的時間才是真的。讀不出來回傳 NaN。
 */
export function idTime(id) {
  const m = /^[a-z]+_([0-9a-z]+)_/.exec(id || "");
  if (!m) return NaN;
  const t = parseInt(m[1], 36);
  // 合理範圍檢查：2020 年之後、現在往後一天之內，避免把奇怪的 id 解讀成怪時間
  return t > 1577836800000 && t < Date.now() + 86400000 ? t : NaN;
}

/**
 * 依建立順序排（先建立的在前）。
 *
 * 同一毫秒建立的人（當初建群組時一次加好幾個）時間一樣，
 * 這時用「在群組名單裡的先後」排——那就是當初輸入的順序。
 * 還是分不出來才比名字，確保每次打開順序都一樣、不會跳來跳去。
 */
export function sortByCreation(users, groups) {
  const firstSeen = new Map();
  let n = 0;
  Object.values(groups || {})
    .slice()
    .sort((a, b) => (idTime(a.id) || a.createdAt || 0) - (idTime(b.id) || b.createdAt || 0))
    .forEach((g) => (g.memberIds || []).forEach((id) => firstSeen.has(id) || firstSeen.set(id, n++)));

  const time = (u) => {
    const t = idTime(u.id);
    return Number.isFinite(t) ? t : u.createdAt || 0;
  };
  return [...users].sort((a, b) => {
    const dt = time(a) - time(b);
    if (dt !== 0) return dt;
    const da = firstSeen.has(a.id) ? firstSeen.get(a.id) : Infinity;
    const db = firstSeen.has(b.id) ? firstSeen.get(b.id) : Infinity;
    if (da !== db) return da - db;
    return a.name.localeCompare(b.name, "zh-Hant");
  });
}

/** 名字裡有沒有打的字（不分大小寫、前後空白不算）。空白查詢回傳全部。 */
export function searchUsers(list, query) {
  const q = nameKey(query);
  if (!q) return list;
  return list.filter((u) => nameKey(u.name).includes(q));
}
