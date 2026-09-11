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

/* ─────────────────────────────────────────────────────────────
 * 補形狀（hydrate）
 *
 * Firebase Realtime Database 會「自動刪掉」三種東西：
 *   ・空陣列   []   —— 例如群組還沒有人被停用時的 inactiveMemberIds
 *   ・空物件   {}   —— 例如均分帳目的 splitWeights
 *   ・值是 null 的欄位 —— 例如沒設密碼的 passwordHash
 * 存進去再讀出來，這些欄位就整個不見了。程式如果直接寫 g.inactiveMemberIds.includes(...)
 * 就會當掉。所以每次讀進來都先把形狀補回來，後面的程式一律可以假設欄位都在。
 *
 * 另外 Firebase 遇到「中間有洞的陣列」會改回傳物件（{0: 'a', 2: 'c'}），
 * 所以 list() 也把物件轉回陣列。
 * ───────────────────────────────────────────────────────────── */

const list = (v) => (Array.isArray(v) ? v.filter((x) => x != null) : v && typeof v === "object" ? Object.values(v) : []);
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const orNull = (v) => (v === undefined ? null : v);

function hydrateUser(u) {
  return {
    ...u,
    passwordHash: orNull(u.passwordHash),
    phone: u.phone ?? "",
    bankCode: u.bankCode ?? "",
    bankAccount: u.bankAccount ?? "",
    otherPayment: u.otherPayment ?? "",
    disabled: !!u.disabled,
    virtual: !!u.virtual,
    ownerGroupId: orNull(u.ownerGroupId),
  };
}

function hydrateGroup(g) {
  return {
    ...g,
    description: g.description ?? "",
    memberIds: list(g.memberIds),
    adminIds: list(g.adminIds),
    inactiveMemberIds: list(g.inactiveMemberIds),
  };
}

function hydrateProject(p) {
  return {
    ...p,
    description: p.description ?? "",
    memberIds: list(p.memberIds),
    collectorId: orNull(p.collectorId),
    createdBy: orNull(p.createdBy),
  };
}

function hydrateExpense(e) {
  const out = {
    ...e,
    note: e.note ?? "",
    createdBy: orNull(e.createdBy),
    lastEditedBy: orNull(e.lastEditedBy),
  };
  // 轉帳沒有付款人／分攤，其他類型才補，免得轉帳多出一堆空欄位
  if ((e.itemType || "expense") !== "transfer") {
    out.payers = list(e.payers);
    out.splitMemberIds = list(e.splitMemberIds);
    out.splitWeights = obj(e.splitWeights);
    out.splitAmounts = obj(e.splitAmounts);
  }
  return out;
}

const mapValues = (m, fn) => Object.fromEntries(Object.entries(obj(m)).map(([k, v]) => [k, fn(v || {})]));

/** 把從任何地方讀來的 v2 資料補成完整形狀。重複呼叫結果不變。 */
export function hydrate(data) {
  const d = obj(data);
  return {
    schemaVersion: SCHEMA_VERSION,
    users: mapValues(d.users, hydrateUser),
    groups: mapValues(d.groups, hydrateGroup),
    projects: mapValues(d.projects, hydrateProject),
    expenses: mapValues(d.expenses, hydrateExpense),
  };
}

/** 把 v1 的資料轉成 v2。已經是 v2 就補好形狀後回傳。 */
export function migrate(data) {
  if (!data || typeof data !== "object") return emptyData();
  if (!isLegacy(data)) return hydrate(data);

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

  return hydrate({ users, groups, projects, expenses });
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

/**
 * 一個正式帳號能不能被降成「虛擬成員」（只有後臺做得到）。
 *
 * 條件是他剛好只屬於一個群組：虛擬成員一定要有歸屬的群組，
 * 同時在兩個以上的群組就無從決定要歸給誰，硬選一個會讓另一個群組
 * 突然多出一個管不到的人。
 */
export function demoteToVirtualCheck(data, userId) {
  const user = (data.users || {})[userId];
  if (!user) return { ok: false, reason: "找不到這個帳號" };
  if (user.virtual) return { ok: false, reason: "他已經是虛擬成員了" };
  const groups = Object.values(data.groups || {}).filter((g) => (g.memberIds || []).includes(userId));
  if (groups.length === 0) {
    return { ok: false, reason: "他還不在任何群組。虛擬成員一定要屬於一個群組，先把他加進群組再轉。" };
  }
  if (groups.length > 1) {
    const names = groups.map((g) => g.name).join("、");
    return { ok: false, reason: `他同時在 ${groups.length} 個群組（${names}），無法決定要歸給哪一個。先把他移出到只剩一個。` };
  }
  const g = groups[0];
  // 虛擬成員不能登入，所以也管不了群組。把最後一個管理者轉成虛擬，
  // 這個群組就再也沒有人能加成員、改設定了。
  const admins = (g.adminIds || []).filter((id) => !(data.users[id] || {}).virtual);
  if (admins.includes(userId) && admins.length <= 1) {
    return {
      ok: false,
      reason: `他是「${g.name}」唯一的管理者。轉成虛擬成員之後就不能登入，這個群組會沒有人能管理。請先指派另一位管理者。`,
    };
  }
  return { ok: true, groupId: g.id, groupName: g.name, reason: "" };
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
