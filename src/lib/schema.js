/**
 * 資料格式版本與遷移。
 *
 * v1：成員住在各自的群組裡（groups[].members[]），沒有帳號的概念。
 * v2：成員升級成全域帳號（users），群組只存 id；群組有管理者、可停用成員。
 *
 * 遷移最重要的一件事：**沿用原本的 member id 當作 user id**。
 * 所有歷史項目都用 memberId 指向成員（payers、splitMemberIds、fromMemberId…），
 * 換 id 會讓 25 筆帳全部找不到人。
 */

export const SCHEMA_VERSION = 2;

// 一次性：把舊群組的這些人設為管理者（依暱稱比對，找不到就略過）。
// 只在 v1 → v2 那一次會用到，之後管理者都由介面指派。
const INITIAL_ADMIN_NAMES = ["猴子", "昭毅", "小比", "軒銘", "德濬", "彥廷", "子謙", "阿愷"];

export function emptyData() {
  return { schemaVersion: SCHEMA_VERSION, users: {}, groups: {}, projects: {}, expenses: {} };
}

function isLegacy(data) {
  if (!data || typeof data !== "object") return false;
  if (data.schemaVersion >= 2) return false;
  // v1 的特徵：群組裡有 members 陣列
  return Object.values(data.groups || {}).some((g) => Array.isArray(g.members));
}

/** 把 v1 的資料轉成 v2。已經是 v2 就原樣回傳。 */
export function migrate(data) {
  if (!data || typeof data !== "object") return emptyData();
  if (!isLegacy(data)) {
    return {
      schemaVersion: SCHEMA_VERSION,
      users: data.users || {},
      groups: data.groups || {},
      projects: data.projects || {},
      expenses: data.expenses || {},
    };
  }

  const users = {};
  const usedNames = new Set();
  const groups = {};

  Object.values(data.groups).forEach((g) => {
    const memberIds = [];
    const inactiveMemberIds = [];
    const adminIds = [];

    (g.members || []).forEach((m) => {
      if (!users[m.id]) {
        // 跨群組同名時加尾碼，暱稱同時是帳號、必須唯一
        let name = (m.name || "").trim() || "未命名";
        if (usedNames.has(name)) {
          let n = 2;
          while (usedNames.has(`${name}(${n})`)) n++;
          name = `${name}(${n})`;
        }
        usedNames.add(name);
        users[m.id] = {
          id: m.id,
          name,
          passwordHash: null, // 遷移過來的帳號一律沒有密碼，之後各自去設
          phone: m.phone || "",
          bankCode: m.bankCode || "",
          bankAccount: m.bankAccount || "",
          otherPayment: m.otherPayment || "",
          disabled: false,
          createdAt: g.createdAt || Date.now(),
        };
      }
      memberIds.push(m.id);
      // v1 的軟刪除成員 → v2 的群組內停用（帳號本身保留）
      if (m.deleted) inactiveMemberIds.push(m.id);
      if (INITIAL_ADMIN_NAMES.includes(users[m.id].name)) adminIds.push(m.id);
    });

    groups[g.id] = {
      id: g.id,
      name: g.name,
      description: g.description || "",
      memberIds,
      adminIds,
      inactiveMemberIds,
      createdAt: g.createdAt || Date.now(),
      // v1 的群組密碼在 v2 拿掉了：已經有帳號登入，而且只看得到自己有份的群組
    };
  });

  const projects = {};
  Object.values(data.projects || {}).forEach((p) => {
    projects[p.id] = { ...p, createdBy: p.createdBy ?? null };
  });

  const expenses = {};
  Object.values(data.expenses || {}).forEach((e) => {
    // 舊資料沒有記「誰建立的」，用最後編輯者當作擁有者；兩者都沒有就留 null
    expenses[e.id] = { ...e, createdBy: e.createdBy ?? e.lastEditedBy ?? null };
  });

  return { schemaVersion: SCHEMA_VERSION, users, groups, projects, expenses };
}

/** 清掉沒有歸屬的資料（群組被刪之後殘留的專案／項目）。 */
export function pruneOrphans(data) {
  const users = data.users || {};
  const groups = {};
  Object.entries(data.groups || {}).forEach(([id, g]) => {
    groups[id] = {
      ...g,
      memberIds: (g.memberIds || []).filter((uid) => users[uid]),
      adminIds: (g.adminIds || []).filter((uid) => users[uid]),
      inactiveMemberIds: (g.inactiveMemberIds || []).filter((uid) => users[uid]),
    };
  });
  const projects = {};
  Object.entries(data.projects || {}).forEach(([id, p]) => {
    if (groups[p.groupId]) projects[id] = p;
  });
  const expenses = {};
  Object.entries(data.expenses || {}).forEach(([id, e]) => {
    if (projects[e.projectId]) expenses[id] = e;
  });
  return { schemaVersion: SCHEMA_VERSION, users, groups, projects, expenses };
}

/** 這筆項目引用到的所有成員 id，用來判斷某人能不能被移出群組。 */
export function memberIdsUsedByExpense(e) {
  const ids = [];
  const type = e.itemType || "expense";
  if (type === "transfer") {
    if (e.fromMemberId) ids.push(e.fromMemberId);
    if (e.toMemberId) ids.push(e.toMemberId);
  } else {
    (e.payers || []).forEach((p) => p.memberId && ids.push(p.memberId));
    (e.splitMemberIds || []).forEach((id) => ids.push(id));
  }
  if (e.createdBy) ids.push(e.createdBy);
  if (e.lastEditedBy) ids.push(e.lastEditedBy);
  return ids;
}

/** 某人在某群組裡有沒有留下任何紀錄（有的話就不能被移出群組，只能停用）。 */
export function hasRecordsInGroup(data, groupId, userId) {
  const projectIds = new Set(
    Object.values(data.projects).filter((p) => p.groupId === groupId).map((p) => p.id)
  );
  return Object.values(data.expenses).some(
    (e) => projectIds.has(e.projectId) && memberIdsUsedByExpense(e).includes(userId)
  );
}
