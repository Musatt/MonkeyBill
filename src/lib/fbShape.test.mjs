/* Firebase 資料整形的回歸測試： node src/lib/fbShape.test.mjs */
import { sanitize, simulateFirebaseStore, invalidKeys, diffToUpdates, applyUpdates } from "./fbShape.js";
import { hydrate, migrate } from "./schema.js";
import { diffData } from "./merge.js";
import { computeBalances, reconcileBalances } from "./money.js";

let pass = 0;
let fail = 0;
const check = (name, cond, detail) => {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
};
// 比較時不管欄位順序：Firebase 讀回來的欄位順序跟存進去的不一樣，但值完全相同，
// 程式裡也沒有任何地方依賴欄位順序。用 JSON.stringify 直接比會誤判成「不一樣」。
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === "object"
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/* 一份刻意踩滿所有 Firebase 地雷的資料 */
const fixture = () => ({
  schemaVersion: 2,
  users: {
    a: { id: "a", name: "猴子", passwordHash: null, phone: "", bankCode: "", bankAccount: "", otherPayment: "", disabled: false, virtual: false, ownerGroupId: null, createdAt: 1 },
    b: { id: "b", name: "小比", passwordHash: "abc", phone: "0912", bankCode: "822", bankAccount: "123", otherPayment: "", disabled: false, virtual: false, ownerGroupId: null, createdAt: 2 },
    v: { id: "v", name: "阿明", passwordHash: null, phone: "", bankCode: "", bankAccount: "", otherPayment: "", disabled: false, virtual: true, ownerGroupId: "g1", createdAt: 3 },
  },
  groups: {
    g1: { id: "g1", name: "群組", description: "", memberIds: ["a", "b", "v"], adminIds: ["a"], inactiveMemberIds: [], createdAt: 1 },
  },
  projects: {
    p1: { id: "p1", groupId: "g1", name: "旅行", description: "", date: "2026-08-22", memberIds: ["a", "b", "v"], baseCurrency: "TWD", settlementDecimals: 0, settlementMode: "one", collectorId: null, createdBy: "a", createdAt: 1 },
  },
  expenses: {
    e1: { id: "e1", projectId: "p1", itemType: "expense", category: "food", note: "晚餐", amount: 1000, currency: "TWD", exchangeRate: 1, baseAmount: 1000,
      payers: [{ memberId: "a", amount: 1000 }], date: "2026-08-22", time: "19:00", splitType: "equal",
      splitMemberIds: ["a", "b", "v"], splitWeights: {}, splitAmounts: {}, createdAt: 1, createdBy: "a", lastEditedBy: null },
    e2: { id: "e2", projectId: "p1", itemType: "expense", category: "stay", note: "民宿", amount: 900, currency: "TWD", exchangeRate: 1, baseAmount: 900,
      payers: [{ memberId: "b", amount: 600 }, { memberId: "v", amount: 300 }], date: "2026-08-22", time: "20:00", splitType: "ratio",
      splitMemberIds: ["a", "b"], splitWeights: { a: 2, b: 1 }, splitAmounts: {}, createdAt: 2, createdBy: "b", lastEditedBy: "a" },
    e3: { id: "e3", projectId: "p1", itemType: "transfer", note: "還款", amount: 200, currency: "TWD", exchangeRate: 1, baseAmount: 200,
      fromMemberId: "v", toMemberId: "a", date: "2026-08-23", time: "10:00", createdAt: 3, createdBy: "a" },
  },
});

const balancesOf = (d) =>
  Object.fromEntries(
    Object.values(d.projects).map((p) => {
      const ex = Object.values(d.expenses).filter((e) => e.projectId === p.id);
      return [p.id, reconcileBalances(computeBalances(p.memberIds, ex, p.settlementDecimals), p.settlementDecimals)];
    })
  );

console.log("\n[寫入前清理]");
check("undefined 欄位被拿掉（SDK 遇到會整筆失敗）", !("x" in sanitize({ x: undefined, y: 1 })));
check("NaN 變成 null", sanitize({ n: NaN }).n === null);
check("巢狀的也清", !("z" in sanitize({ a: { z: undefined } }).a));
check("正常資料原封不動", same(sanitize(fixture()), fixture()));

console.log("\n[模擬 Firebase 會吃掉什麼]");
{
  const s = simulateFirebaseStore(fixture());
  check("空陣列消失（inactiveMemberIds）", !("inactiveMemberIds" in s.groups.g1));
  check("空物件消失（splitWeights）", !("splitWeights" in s.expenses.e1));
  check("null 欄位消失（passwordHash）", !("passwordHash" in s.users.a));
  check("空字串保留（Firebase 會存空字串）", s.users.a.phone === "");
  check("false 保留", s.users.a.disabled === false);
  check("非空陣列保留", same(s.groups.g1.memberIds, ["a", "b", "v"]));
  check("中間有洞的陣列變成物件", same(simulateFirebaseStore(["a", null, "c"]), { 0: "a", 2: "c" }));
  check("整個清空的父層也跟著消失", simulateFirebaseStore({ a: { b: [] } }) === undefined);
}

console.log("\n[補形狀：存進 Firebase 再讀出來要跟原本一模一樣]");
{
  const original = hydrate(fixture());
  const roundTrip = hydrate(simulateFirebaseStore(fixture()));
  check("完整資料來回一趟完全相同", same(roundTrip, original));
  check("inactiveMemberIds 補回空陣列", Array.isArray(roundTrip.groups.g1.inactiveMemberIds));
  check("splitWeights 補回空物件", same(roundTrip.expenses.e1.splitWeights, {}));
  check("passwordHash 補回 null", roundTrip.users.a.passwordHash === null);
  check("ownerGroupId 補回 null", roundTrip.users.a.ownerGroupId === null);
  check("虛擬成員的 ownerGroupId 保留", roundTrip.users.v.ownerGroupId === "g1");
  check("轉帳不會被補出 payers 之類的空欄位", !("payers" in roundTrip.expenses.e3));
  check("中間有洞的陣列讀回來變回陣列", same(hydrate({ groups: { g: { memberIds: { 0: "a", 2: "c" } } } }).groups.g.memberIds, ["a", "c"]));
  check("補形狀重複做結果不變", same(hydrate(roundTrip), roundTrip));
  check("migrate 對 Firebase 讀回的資料也適用", same(migrate(simulateFirebaseStore(fixture())), original));
}

console.log("\n[最重要的：來回一趟之後，每個人的餘額一分不差]");
{
  const before = balancesOf(hydrate(fixture()));
  const after = balancesOf(hydrate(simulateFirebaseStore(fixture())));
  // 先確認比較的東西不是空的：reconcileBalances 只列出還沒結清的人，
  // 如果全部都結清了，兩邊都是 {}，下面那條「完全相同」就會空洞地通過。
  check("測試資料真的有人還沒結清（避免空比空）", Object.keys(before.p1).length >= 2, before.p1);
  check("所有專案所有人的餘額完全相同", same(before, after), { before, after });
  const sum = Object.values(after.p1).reduce((s, v) => s + v, 0);
  check("餘額總和仍然是 0", Math.abs(sum) < 1e-9, sum);
}

console.log("\n[不合法的 key]");
check("正常資料沒有壞 key", invalidKeys(fixture()).length === 0);
check("含 . 的 key 抓得到", same(invalidKeys({ users: { "a.b": {} } }), ["users/a.b"]));
check("含 / 的 key 抓得到", invalidKeys({ x: { "a/b": 1 } }).length === 1);
check("含 # $ [ ] 的都抓得到", invalidKeys({ "a#": 1, "b$": 1, "c[": 1, "d]": 1 }).length === 4);
check("陣列索引不算壞 key", invalidKeys({ a: [1, 2] }).length === 0);

console.log("\n[多路徑更新：只寫動到的那幾筆]");
{
  const prev = hydrate(fixture());
  const next = {
    ...prev,
    expenses: { ...prev.expenses, e1: { ...prev.expenses.e1, note: "改過的晚餐" } },
    users: Object.fromEntries(Object.entries(prev.users).filter(([id]) => id !== "v")),
  };
  const updates = diffToUpdates(diffData(prev, next));
  check("只包含改過的帳和刪掉的人", same(Object.keys(updates).sort(), ["expenses/e1", "users/v"]));
  check("刪除用 null 表示", updates["users/v"] === null);
  check("沒動的那幾筆不會被送出去", !("expenses/e2" in updates));

  const stored = applyUpdates(simulateFirebaseStore(prev), updates);
  const read = hydrate(stored);
  check("套用後改到的那筆變了", read.expenses.e1.note === "改過的晚餐");
  check("套用後刪掉的那筆不見了", !("v" in read.users));
  check("沒動的那筆原封不動", same(read.expenses.e2, prev.expenses.e2));
}

console.log("\n[兩個人同時記不同的帳，互相不會蓋掉]");
{
  const base = hydrate(fixture());
  const mine = diffToUpdates(diffData(base, { ...base, expenses: { ...base.expenses, m: { ...base.expenses.e1, id: "m", note: "我的" } } }));
  const yours = diffToUpdates(diffData(base, { ...base, expenses: { ...base.expenses, y: { ...base.expenses.e1, id: "y", note: "你的" } } }));
  // 各自從同一個舊畫面出發，先後送出
  const final = hydrate(applyUpdates(applyUpdates(simulateFirebaseStore(base), mine), yours));
  check("我的那筆還在", final.expenses.m?.note === "我的");
  check("你的那筆也在", final.expenses.y?.note === "你的");
  check("原本的帳都還在", ["e1", "e2", "e3"].every((id) => id in final.expenses));
}

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
