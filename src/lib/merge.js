/* 逐筆合併：兩個人同時記帳時，只覆寫自己動過的那幾筆，不整包蓋掉對方的紀錄。 */

const KINDS = ["groups", "projects", "expenses"];

export function emptyData() {
  return { groups: {}, projects: {}, expenses: {} };
}

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

/** 把「我動過的部分」套到剛從雲端讀回來的資料上。 */
export function applyDiff(base, diff) {
  const out = emptyData();
  for (const kind of KINDS) {
    const m = { ...(base?.[kind] || {}) };
    diff.remove[kind].forEach((id) => delete m[id]);
    Object.assign(m, diff.upsert[kind]);
    out[kind] = m;
  }
  return pruneOrphans(out);
}

/**
 * 清掉孤兒資料：群組被刪掉之後，別台裝置可能剛好又新增了底下的專案/項目，
 * 合併完會留下沒有歸屬的資料，這裡一併清掉。
 */
export function pruneOrphans(data) {
  const groups = data.groups || {};
  const projects = {};
  Object.entries(data.projects || {}).forEach(([id, p]) => {
    if (groups[p.groupId]) projects[id] = p;
  });
  const expenses = {};
  Object.entries(data.expenses || {}).forEach(([id, e]) => {
    if (projects[e.projectId]) expenses[id] = e;
  });
  return { groups, projects, expenses };
}
