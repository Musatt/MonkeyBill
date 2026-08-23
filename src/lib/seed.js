import { uid } from "./format.js";

/**
 * 只有在「雲端讀取成功、而且確定連資料列都不存在」時才會用到。
 * 讀取失敗絕對不會走到這裡（見 supabase.js 的說明）。
 */
export function buildSeedData() {
  const groupId = uid("g");
  const names = ["猴子", "昭毅", "小比", "軒銘", "德濬", "彥廷", "子謙", "阿愷", "正傑"];
  const members = names.map((name) => ({ id: uid("mem"), name, phone: "", bankCode: "", bankAccount: "", otherPayment: "" }));
  const byName = Object.fromEntries(members.map((m) => [m.name, m.id]));

  const projectId = uid("p");
  const projectMemberIds = members.filter((m) => m.name !== "正傑").map((m) => m.id);

  const expenseId = uid("e");
  const expense = {
    id: expenseId,
    projectId,
    itemType: "expense",
    category: "food",
    note: "酒",
    amount: 2000,
    currency: "TWD",
    exchangeRate: 1,
    baseAmount: 2000,
    payers: [{ memberId: byName["猴子"], amount: 2000 }],
    date: "2026-08-22",
    time: "20:00",
    splitType: "equal",
    splitMemberIds: [...projectMemberIds],
    splitWeights: {},
    splitAmounts: {},
    createdAt: Date.now(),
  };

  const group = { id: groupId, name: "勿考試喝酒", description: "", members, createdAt: Date.now() };
  const project = {
    id: projectId,
    groupId,
    name: "822軒銘家",
    description: "",
    date: "2026-08-22",
    memberIds: projectMemberIds,
    baseCurrency: "TWD",
    settlementDecimals: 0,
    settlementMode: "min",
    collectorId: byName["猴子"],
    createdAt: Date.now(),
  };

  return { groups: { [groupId]: group }, projects: { [projectId]: project }, expenses: { [expenseId]: expense } };
}
