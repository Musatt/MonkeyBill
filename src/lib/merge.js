/* 算出「這次操作動到了哪幾筆」，只把那幾筆送去資料庫，不整包覆寫。 */

import { emptyData, pruneOrphans } from "./schema.js";

const KINDS = ["users", "groups", "projects", "expenses"];

export { emptyData, pruneOrphans };

/** 比較編輯前後，算出「我動了哪些東西」。 */
export function diffData(prev, next) {
  const upsert = {};
  const remove = {};
  for (const kind of KINDS) {
    const p = prev?.[kind] || {};
    const n = next?.[kind] || {};
    const up = {};
    // 所有更新路徑都是 immutable 的，所以參考不同就代表這筆被動過。
    for (const [id, v] of Object.entries(n)) if (p[id] !== v) up[id] = v;
    upsert[kind] = up;
    remove[kind] = Object.keys(p).filter((id) => !(id in n));
  }
  return { upsert, remove };
}

export function isEmptyDiff(diff) {
  return KINDS.every((k) => Object.keys(diff.upsert[k]).length === 0 && diff.remove[k].length === 0);
}
