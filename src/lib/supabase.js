import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_TABLE, RECORD_ID } from "../constants.js";

const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };

/**
 * 讀取雲端資料。
 * - 成功且資料列存在 → 回傳 data 物件
 * - 成功但資料列不存在 → 回傳 null（確定是空資料庫）
 * - 讀取失敗 → throw
 *
 * 「讀取失敗」一定要用 throw 跟「空資料庫」區分開。舊版把錯誤吞掉一律回 null，
 * 結果 Supabase 一有 5xx 或權限問題，App 就以為是全新資料庫，
 * 直接把範例資料寫回去蓋掉所有人的帳。
 */
export async function supabaseGet() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${RECORD_ID}&select=data`,
    { headers }
  );
  if (!res.ok) throw new Error(`讀取失敗: HTTP ${res.status}`);
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0].data ?? null;
}

export async function supabaseSet(data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ id: RECORD_ID, data, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`寫入失敗: HTTP ${res.status}`);
}
