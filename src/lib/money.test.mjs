/* 分帳運算的回歸測試： node src/lib/money.test.mjs */
import {
  computeItemAllocation,
  computeBalances,
  reconcileBalances,
  simplifyDebts,
  oneCollectorSettlement,
  isProjectSettled,
} from "./money.js";

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); }
}
function sum(o) { return Object.values(o).reduce((s, v) => s + v, 0); }
const mk = (o) => ({ itemType: "expense", currency: "TWD", exchangeRate: 1, splitWeights: {}, splitAmounts: {}, ...o });

console.log("\n[餘額總和必須為 0 —— 整個 App 的基本前提]");
const balanceCases = [
  ["1000 均分 3 人", mk({ amount: 1000, baseAmount: 1000, payers: [{ memberId: "a", amount: 1000 }], splitType: "equal", splitMemberIds: ["a", "b", "c"] })],
  ["100 均分 3 人", mk({ amount: 100, baseAmount: 100, payers: [{ memberId: "a", amount: 100 }], splitType: "equal", splitMemberIds: ["a", "b", "c"] })],
  ["700 兩人共同付款、分 3 人", mk({ amount: 700, baseAmount: 700, payers: [{ memberId: "a", amount: 400 }, { memberId: "b", amount: 300 }], splitType: "equal", splitMemberIds: ["a", "b", "c"] })],
  ["1000 依比例 1:1:1", mk({ amount: 1000, baseAmount: 1000, payers: [{ memberId: "a", amount: 1000 }], splitType: "ratio", splitMemberIds: ["a", "b", "c"], splitWeights: { a: 1, b: 1, c: 1 } })],
  ["1000 依比例 2:3:5", mk({ amount: 1000, baseAmount: 1000, payers: [{ memberId: "a", amount: 1000 }], splitType: "ratio", splitMemberIds: ["a", "b", "c"], splitWeights: { a: 2, b: 3, c: 5 } })],
  ["自訂金額 30/30/40", mk({ amount: 100, baseAmount: 100, payers: [{ memberId: "a", amount: 100 }], splitType: "custom", splitMemberIds: ["a", "b", "c"], splitAmounts: { a: 30, b: 30, c: 40 } })],
  ["外幣 10000 JPY x0.21 分 3 人", mk({ amount: 10000, currency: "JPY", exchangeRate: 0.21, baseAmount: 2100, payers: [{ memberId: "a", amount: 10000 }], splitType: "equal", splitMemberIds: ["a", "b", "c"] })],
  ["收入 1000 由 3 人收", mk({ itemType: "collection", amount: 1000, baseAmount: 1000, payers: [{ memberId: "a", amount: 1000 }], splitType: "equal", splitMemberIds: ["a", "b", "c"] })],
  ["1 元均分 7 人（極端進位）", mk({ amount: 1, baseAmount: 1, payers: [{ memberId: "a", amount: 1 }], splitType: "equal", splitMemberIds: ["a", "b", "c", "d", "e", "f", "g"] })],
];
for (const [name, e] of balanceCases) {
  const ids = [...new Set([...(e.splitMemberIds || []), ...(e.payers || []).map((p) => p.memberId)])];
  const s = sum(computeBalances(ids, [e]));
  check(name, Math.abs(s) < 1e-9, { sum: s });
}

console.log("\n[轉帳]");
{
  const t = { itemType: "transfer", baseAmount: 250, fromMemberId: "a", toMemberId: "b" };
  const b = computeBalances(["a", "b"], [t]);
  check("轉帳後總和為 0", Math.abs(sum(b)) < 1e-9, b);
  check("付款人餘額 +250、收款人 -250", b.a === 250 && b.b === -250, b);
}

console.log("\n[結算]");
{
  const e = mk({ amount: 2000, baseAmount: 2000, payers: [{ memberId: "a", amount: 2000 }], splitType: "equal", splitMemberIds: ["a", "b", "c", "d", "e", "f", "g", "h"] });
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rec = reconcileBalances(computeBalances(ids, [e]), 0);
  check("結算後總和為 0", Math.abs(sum(rec)) < 1e-9, rec);
  check("最少轉帳：7 筆", simplifyDebts(rec, 0).length === 7);
  const txns = simplifyDebts(rec, 0);
  check("轉帳金額合計 = 收款人應收", Math.abs(txns.reduce((s, t) => s + t.amount, 0) - rec.a) < 1e-9, { txns, a: rec.a });
  const one = oneCollectorSettlement(rec, "b", 0);
  check("指定一人全收發：每個非收發人各一筆", one.length === 7, one);
}

console.log("\n[小數位結算]");
for (const d of [0, 1, 2]) {
  const e = mk({ amount: 1000, baseAmount: 1000, payers: [{ memberId: "a", amount: 1000 }], splitType: "equal", splitMemberIds: ["a", "b", "c"] });
  const rec = reconcileBalances(computeBalances(["a", "b", "c"], [e]), d);
  check(`結算取 ${d} 位小數，總和為 0`, Math.abs(sum(rec)) < 1e-9, rec);
}

console.log("\n[結清判定]");
{
  const p = { memberIds: ["a", "b"], settlementDecimals: 0 };
  check("沒有項目視為已結清", isProjectSettled(p, []));
  const e = mk({ amount: 100, baseAmount: 100, payers: [{ memberId: "a", amount: 100 }], splitType: "equal", splitMemberIds: ["a", "b"] });
  check("有未還款項時未結清", !isProjectSettled(p, [e]));
  const t = { itemType: "transfer", baseAmount: 50, fromMemberId: "b", toMemberId: "a" };
  check("還款後結清", isProjectSettled(p, [e, t]));
}

console.log("\n[防呆]");
{
  const e = mk({ amount: 100, baseAmount: 100, payers: [], splitType: "equal", splitMemberIds: ["a", "b"] });
  check("沒有付款人時不會 crash", typeof computeItemAllocation(e).shares.a === "number");
}

console.log("\n[還款後不能冒出多餘餘額 —— 進位尾差回歸測試]");
{
  // 2416 元 12 人均分，每人真實分攤 201.333…
  // 舊版分攤算到小數兩位(201.34)、結算叫人付 202，付完多出 0.66，
  // 再進位一次就變成整整 +1，還會產生叫別人付錢給他的假轉帳。
  const members = Array.from({ length: 12 }, (_, i) => `m${i}`);
  const payer = members[0];
  const debtor = members[1];
  const expense = mk({
    amount: 2416,
    baseAmount: 2416,
    payers: [{ memberId: payer, amount: 2416 }],
    splitType: "equal",
    splitMemberIds: [...members],
  });
  for (const d of [0, 1, 2]) {
    const rec1 = reconcileBalances(computeBalances(members, [expense], d), d);
    const owed = -rec1[debtor];
    const repay = { itemType: "transfer", baseAmount: owed, fromMemberId: debtor, toMemberId: payer };
    const raw2 = computeBalances(members, [expense, repay], d);
    const rec2 = reconcileBalances(raw2, d);
    check(`結算取 ${d} 位：還款後該員餘額歸零`, (rec2[debtor] ?? 0) === 0, { 顯示: rec2[debtor], 真實: raw2[debtor] });
    check(`結算取 ${d} 位：還款後總和仍為 0`, Math.abs(sum(rec2)) < 1e-9, { sum: sum(rec2) });
    check(
      `結算取 ${d} 位：不會冒出付錢給已還清者的假轉帳`,
      !simplifyDebts(rec2, d).some((t) => t.to === debtor),
      simplifyDebts(rec2, d)
    );
  }
}

console.log("\n[多人共同付款也不能破壞平帳]");
for (const d of [0, 1, 2]) {
  const e = mk({
    amount: 700,
    baseAmount: 699.93,
    payers: [{ memberId: "a", amount: 400 }, { memberId: "b", amount: 300 }],
    splitType: "equal",
    splitMemberIds: ["a", "b", "c"],
  });
  const b = computeBalances(["a", "b", "c"], [e], d);
  check(`結算取 ${d} 位：多人共同付款總和為 0`, Math.abs(sum(b)) < 1e-9, b);
}

console.log("\n[所有人依序還清後應完全結清]");
{
  const members = Array.from({ length: 12 }, (_, i) => `m${i}`);
  const expense = mk({
    amount: 2416,
    baseAmount: 2416,
    payers: [{ memberId: members[0], amount: 2416 }],
    splitType: "equal",
    splitMemberIds: [...members],
  });
  const d = 0;
  const items = [expense];
  for (let guard = 0; guard < 40; guard++) {
    const txns = simplifyDebts(reconcileBalances(computeBalances(members, items, d), d), d);
    if (txns.length === 0) break;
    const t = txns[0];
    items.push({ itemType: "transfer", baseAmount: t.amount, fromMemberId: t.from, toMemberId: t.to });
  }
  const finalRec = reconcileBalances(computeBalances(members, items, d), d);
  check("依序還清後沒有殘留餘額", Object.values(finalRec).every((v) => Math.abs(v) < 1e-9), finalRec);
  check("還款筆數 = 人數-1（沒有多餘的來回轉帳）", items.length - 1 === members.length - 1, { 轉帳筆數: items.length - 1 });
}

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
