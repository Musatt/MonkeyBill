/**
 * 在本機用 database.rules.json 裡同樣的條件檢查一份資料，
 * 找出「送上 Firebase 會被安全規則擋下」的紀錄。搬家前跑一次。
 *
 * 這裡的條件要跟 database.rules.json 的 .validate 保持一致——改了一邊就要改另一邊。
 */
const RULES = {
  users: (id, v) => v.id === id && typeof v.name === "string",
  groups: (id, v) => v.id === id && typeof v.name === "string",
  projects: (id, v) => v.id === id && typeof v.groupId === "string",
  expenses: (id, v) => v.id === id && typeof v.projectId === "string" && typeof v.baseAmount === "number",
};

/** 回傳所有不合規則的紀錄路徑，例如 ["expenses/e_123"]。 */
export function rulesViolations(data) {
  const bad = [];
  for (const [kind, ok] of Object.entries(RULES)) {
    for (const [id, v] of Object.entries(data[kind] || {})) {
      if (!v || typeof v !== "object" || !ok(id, v)) bad.push(`${kind}/${id}`);
    }
  }
  return bad;
}
