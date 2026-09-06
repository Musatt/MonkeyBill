/* 資料遷移與權限的回歸測試： node src/lib/schema.test.mjs */
import {
  migrate,
  pruneOrphans,
  memberIdsUsedByExpense,
  hasRecordsInGroup,
  demoteToVirtualCheck,
  SCHEMA_VERSION,
} from "./schema.js";
import {
  isGroupAdmin,
  canDeleteGroup,
  canDeleteProject,
  canDeleteExpense,
  canEditExpense,
  canAddExpense,
  isPickable,
  isVirtual,
  canLogin,
  canJoinGroup,
  canEditIdentity,
  canPromoteToReal,
  canDeleteVirtualMember,
} from "./permissions.js";

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}

/** 造一份 v1 格式的資料（成員住在群組裡、沒有帳號概念） */
function legacyData() {
  return {
    groups: {
      g1: {
        id: "g1",
        name: "勿考試喝酒",
        description: "",
        password: "1234",
        createdAt: 1000,
        members: [
          { id: "m1", name: "猴子", phone: "0912", bankCode: "822", bankAccount: "111", otherPayment: "" },
          { id: "m2", name: "昭毅", phone: "", bankCode: "", bankAccount: "", otherPayment: "" },
          { id: "m3", name: "正傑", phone: "", bankCode: "", bankAccount: "", otherPayment: "", deleted: true },
        ],
      },
    },
    projects: {
      p1: { id: "p1", groupId: "g1", name: "822", memberIds: ["m1", "m2"], baseCurrency: "TWD", settlementDecimals: 0 },
    },
    expenses: {
      e1: {
        id: "e1", projectId: "p1", itemType: "expense", category: "food", note: "酒",
        amount: 300, currency: "TWD", exchangeRate: 1, baseAmount: 300,
        payers: [{ memberId: "m1", amount: 300 }],
        splitType: "equal", splitMemberIds: ["m1", "m2"], splitWeights: {}, splitAmounts: {},
        date: "2026-08-22", time: "20:00", lastEditedBy: "m2",
      },
    },
  };
}

console.log("\n[v1 → v2 遷移]");
{
  const v1 = legacyData();
  const v2 = migrate(v1);

  check("標上版本號", v2.schemaVersion === SCHEMA_VERSION);
  check("成員升級成全域帳號", Object.keys(v2.users).length === 3);
  check("帳號 id 沿用原本的 member id（歷史紀錄才不會斷）",
    ["m1", "m2", "m3"].every((id) => v2.users[id]));
  check("帳號沒有密碼（要各自去設）", Object.values(v2.users).every((u) => u.passwordHash === null));
  check("銀行資料保留", v2.users.m1.bankCode === "822" && v2.users.m1.bankAccount === "111");
  check("群組改存 memberIds", JSON.stringify(v2.groups.g1.memberIds) === JSON.stringify(["m1", "m2", "m3"]));
  check("v1 的軟刪除成員變成群組內停用",
    JSON.stringify(v2.groups.g1.inactiveMemberIds) === JSON.stringify(["m3"]));
  check("群組密碼被移除", v2.groups.g1.password === undefined);
  check("項目補上建立者（沿用 lastEditedBy）", v2.expenses.e1.createdBy === "m2");
  check("項目其他欄位不動", v2.expenses.e1.baseAmount === 300 && v2.expenses.e1.note === "酒");
  check("專案筆數不變", Object.keys(v2.projects).length === 1);

  check("重複遷移是冪等的", JSON.stringify(migrate(migrate(v1))) === JSON.stringify(v2));
  check("已經是 v2 的資料原樣通過", JSON.stringify(migrate(v2)) === JSON.stringify(v2));
}

console.log("\n[跨群組同名要能區分]");
{
  const v1 = legacyData();
  v1.groups.g2 = {
    id: "g2", name: "另一群", description: "", createdAt: 2000,
    members: [{ id: "m9", name: "猴子", phone: "", bankCode: "", bankAccount: "", otherPayment: "" }],
  };
  const v2 = migrate(v1);
  const names = Object.values(v2.users).map((u) => u.name);
  check("同名會加尾碼，暱稱保持唯一", new Set(names).size === names.length, names);
  check("兩個猴子是不同帳號", v2.users.m1.id !== v2.users.m9.id);
}

console.log("\n[孤兒清理]");
{
  const v2 = migrate(legacyData());
  v2.projects.pX = { id: "pX", groupId: "沒這個群組", name: "孤兒", memberIds: [] };
  v2.expenses.eX = { id: "eX", projectId: "pX", itemType: "expense", baseAmount: 1 };
  const pruned = pruneOrphans(v2);
  check("刪掉沒有群組的專案", !pruned.projects.pX);
  check("刪掉沒有專案的項目", !pruned.expenses.eX);
  check("正常資料不受影響", !!pruned.projects.p1 && !!pruned.expenses.e1);
}

console.log("\n[誰有紀錄、不能被移出群組]");
{
  const v2 = migrate(legacyData());
  check("有記帳的人不能移出", hasRecordsInGroup(v2, "g1", "m1") === true);
  check("被分攤到的人不能移出", hasRecordsInGroup(v2, "g1", "m2") === true);
  check("完全沒紀錄的人可以移出", hasRecordsInGroup(v2, "g1", "m3") === false);
  check("轉帳雙方都算有紀錄",
    memberIdsUsedByExpense({ itemType: "transfer", fromMemberId: "a", toMemberId: "b" }).sort().join() === "a,b");
}

console.log("\n[權限]");
{
  const group = { memberIds: ["a", "b"], adminIds: ["a"], inactiveMemberIds: ["c"] };
  check("管理者能刪群組", canDeleteGroup(group, "a", false));
  check("一般成員不能刪群組", !canDeleteGroup(group, "b", false));
  check("一般成員不能刪專案", !canDeleteProject(group, "b", false));
  check("後臺等同管理者", canDeleteGroup(group, null, true) && canDeleteProject(group, null, true));
  check("非成員不能新增項目", !canAddExpense(group, "z", false));
  check("成員能編輯任何人的項目", canEditExpense(group, "b", false));
  check("成員只能刪自己建的", canDeleteExpense({ createdBy: "b" }, group, "b", false));
  check("成員不能刪別人建的", !canDeleteExpense({ createdBy: "a" }, group, "b", false));
  check("管理者能刪任何一筆", canDeleteExpense({ createdBy: "b" }, group, "a", false));
  check("沒有建立者的舊資料只有管理者能刪",
    !canDeleteExpense({ createdBy: null }, group, "b", false) &&
    canDeleteExpense({ createdBy: null }, group, "a", false));
  check("最後一個管理者仍是管理者", isGroupAdmin(group, "a", false));
}

console.log("\n[停用的人不出現在選單，但資料還在]");
{
  const group = { memberIds: ["a", "b", "c"], adminIds: ["a"], inactiveMemberIds: ["c"] };
  check("正常成員可選", isPickable({ id: "b", disabled: false }, group));
  check("群組內停用不可選", !isPickable({ id: "c", disabled: false }, group));
  check("後臺全域停用不可選", !isPickable({ id: "b", disabled: true }, group));
  check("停用不影響 memberIds（餘額照算）", group.memberIds.includes("c"));
}

console.log("\n[虛擬成員：不能登入，只屬於自己的群組]");
{
  const real = { id: "r1", name: "猴子", disabled: false };
  const noPw = { id: "r2", name: "小比", disabled: false };
  const ghost = { id: "v1", name: "阿明", disabled: false, virtual: true, ownerGroupId: "g1" };
  const g1 = { id: "g1", memberIds: ["r1", "v1"], adminIds: ["r1"], inactiveMemberIds: [] };
  const g2 = { id: "g2", memberIds: ["r2"], adminIds: ["r2"], inactiveMemberIds: [] };

  check("正式帳號可以登入", canLogin(real));
  check("沒設密碼的正式帳號一樣出現在登入頁（這正是要防的洞）", canLogin(noPw));
  check("虛擬成員不能登入", !canLogin(ghost));
  check("被停用的帳號不能登入", !canLogin({ ...real, disabled: true }));
  check("isVirtual 認得出來", isVirtual(ghost) && !isVirtual(real));

  check("虛擬成員可以留在自己的群組", canJoinGroup(ghost, "g1"));
  check("虛擬成員不能被加進別的群組", !canJoinGroup(ghost, "g2"));
  check("正式帳號哪個群組都能加", canJoinGroup(real, "g2"));

  check("虛擬成員照樣可以被選來分帳", isPickable(ghost, g1));
  check("虛擬成員被群組停用後就不可選", !isPickable(ghost, { ...g1, inactiveMemberIds: ["v1"] }));

  check("本人能改自己的暱稱", canEditIdentity(real, "r1", g1, false));
  check("別人不能改我的暱稱", !canEditIdentity(real, "r2", g1, false));
  check("虛擬成員的暱稱由所屬群組管理者改", canEditIdentity(ghost, "r1", g1, false));
  check("非管理者不能改虛擬成員的暱稱", !canEditIdentity(ghost, "r2", g1, false));
  check("後臺什麼都能改", canEditIdentity(ghost, null, g2, true));

  check("所屬群組的管理者可以把虛擬成員轉正", canPromoteToReal(ghost, "r1", g1, false));
  check("別的群組的管理者不行", !canPromoteToReal(ghost, "r2", g2, false));
  check("正式帳號沒有「轉正」這件事", !canPromoteToReal(real, "r1", g1, false));

  // 虛擬成員只存在於這個群組，所以群組管理者就能刪，不必經過後臺
  check("管理者可以刪自己群組的虛擬成員", canDeleteVirtualMember(ghost, "r1", g1, false, false));
  check("有帳目紀錄的虛擬成員不能刪", !canDeleteVirtualMember(ghost, "r1", g1, false, true));
  check("非管理者不能刪", !canDeleteVirtualMember(ghost, "r2", g1, false, false));
  check("別的群組不能刪", !canDeleteVirtualMember(ghost, "r2", g2, false, false));
  check("正式帳號不能用這條路刪掉", !canDeleteVirtualMember(real, "r1", g1, false, false));
  check("後臺也擋有紀錄的", !canDeleteVirtualMember(ghost, null, g1, true, true));
}

console.log("\n[正式帳號降成虛擬成員：只有剛好在一個群組時才行]");
{
  const base = {
    users: {
      a: { id: "a", name: "A" },
      b: { id: "b", name: "B" },
      c: { id: "c", name: "C" },
      v: { id: "v", name: "V", virtual: true, ownerGroupId: "g1" },
    },
    groups: {
      g1: { id: "g1", name: "群組一", memberIds: ["a", "b", "v"], adminIds: ["a", "b"] },
      g2: { id: "g2", name: "群組二", memberIds: ["b"], adminIds: ["b"] },
    },
    projects: {},
    expenses: {},
  };
  const only = demoteToVirtualCheck(base, "a");
  check("只在一個群組 → 可以，並算出歸屬群組", only.ok && only.groupId === "g1", only);
  const many = demoteToVirtualCheck(base, "b");
  check("在兩個群組 → 不行", !many.ok);
  check("不行的時候要說得出原因", many.reason.includes("2 個群組"), many.reason);
  const none = demoteToVirtualCheck(base, "c");
  check("不在任何群組 → 不行", !none.ok);
  check("已經是虛擬成員 → 不行", !demoteToVirtualCheck(base, "v").ok);
  check("找不到帳號 → 不行", !demoteToVirtualCheck(base, "zzz").ok);

  // 虛擬成員不能登入＝不能管理群組，把唯一的管理者降級會讓群組沒人管得動
  const soloAdmin = {
    ...base,
    groups: { g1: { id: "g1", name: "群組一", memberIds: ["a", "v"], adminIds: ["a"] } },
  };
  const solo = demoteToVirtualCheck(soloAdmin, "a");
  check("唯一的管理者不能被降成虛擬成員", !solo.ok, solo);
  check("並且要說出是因為唯一管理者", solo.reason.includes("唯一的管理者"), solo.reason);

  // 虛擬成員就算掛在 adminIds 上也不算數（他本來就登不進來）
  const ghostAdmin = {
    ...base,
    groups: { g1: { id: "g1", name: "群組一", memberIds: ["a", "v"], adminIds: ["a", "v"] } },
  };
  check("虛擬成員不算有效管理者", !demoteToVirtualCheck(ghostAdmin, "a").ok);
}

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
