/**
 * 跟 Firebase Realtime Database 打交道時的資料整形。都是純函式，可以在 node 底下測。
 *
 * 資料在 Firebase 上的樣子：
 *   /ledger/users/{id}      一個人一筆
 *   /ledger/groups/{id}
 *   /ledger/projects/{id}
 *   /ledger/expenses/{id}
 *
 * 一筆一個路徑，寫入就只碰「動到的那幾筆」。兩個人同時記不同的帳，
 * 永遠不會互相蓋掉——以前在 Supabase 要自己「先讀、合併、再寫」才做得到，
 * 在這裡是資料結構本身就保證的。
 */

export const KINDS = ["users", "groups", "projects", "expenses"];

/**
 * 寫進 Firebase 之前清一遍。
 * ・undefined —— Firebase SDK 遇到會直接丟錯誤、整筆寫入失敗，所以拿掉
 * ・NaN / Infinity —— 不是合法的 JSON 數字，換成 null（等於不存）
 */
export function sanitize(value) {
  if (value === undefined) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) return value.map((v) => (v === undefined ? null : sanitize(v)));
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const s = sanitize(v);
      if (s !== undefined) out[k] = s;
    }
    return out;
  }
  return value;
}

/**
 * 模擬 Firebase 存進去再讀出來會變成什麼樣子：
 * null、空陣列、空物件全部消失（而且是由內往外，清空之後父層變空也會跟著消失）。
 *
 * 測試跟本機假資料庫都用這個，這樣「欄位被 Firebase 吃掉」的 bug 在本機就會現形，
 * 不用等到接上真的資料庫才發現。
 */
export function simulateFirebaseStore(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number" && !Number.isFinite(value)) return undefined;
  if (Array.isArray(value)) {
    const items = value.map(simulateFirebaseStore);
    if (items.every((v) => v === undefined)) return undefined;
    // 陣列中間有洞時 Firebase 會改用物件回傳（key 是原本的索引）
    if (items.some((v) => v === undefined)) {
      const o = {};
      items.forEach((v, i) => v !== undefined && (o[i] = v));
      return o;
    }
    return items;
  }
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      const s = simulateFirebaseStore(v);
      if (s !== undefined) out[k] = s;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return value;
}

/** Firebase 的 key 不能含這些字元，也不能是空字串。 */
const BAD_KEY = /[.#$/[\]]/;

/** 找出所有不能當 Firebase key 的欄位名稱，回傳它們的完整路徑。搬家前先檢查一遍。 */
export function invalidKeys(value, path = "") {
  const bad = [];
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const p = path ? `${path}/${k}` : k;
      if (!Array.isArray(value) && (k === "" || BAD_KEY.test(k))) bad.push(p);
      bad.push(...invalidKeys(v, p));
    }
  }
  return bad;
}

/**
 * 把 diffData() 算出來的差異轉成 Firebase 的「多路徑更新」：
 *   { "expenses/e1": {...}, "users/u2": null }
 * 一次送出、全部成功或全部失敗。值是 null 代表刪除那一筆。
 */
export function diffToUpdates(diff) {
  const updates = {};
  for (const kind of KINDS) {
    for (const [id, item] of Object.entries(diff.upsert[kind] || {})) updates[`${kind}/${id}`] = sanitize(item);
    for (const id of diff.remove[kind] || []) updates[`${kind}/${id}`] = null;
  }
  return updates;
}

/** 把多路徑更新套到一份資料上（本機假資料庫用，行為要跟 Firebase 一樣）。 */
export function applyUpdates(base, updates) {
  const out = { ...(base || {}) };
  for (const [path, value] of Object.entries(updates)) {
    const [kind, id] = path.split("/");
    const coll = { ...(out[kind] || {}) };
    if (value === null) delete coll[id];
    else coll[id] = value;
    out[kind] = coll;
  }
  return simulateFirebaseStore(out) || {};
}
