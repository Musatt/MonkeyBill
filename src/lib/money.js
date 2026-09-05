/* 分帳核心運算。改這裡之前先跑 npm test（src/lib/money.test.mjs）。 */

const EPS = 1e-6;

// 無條件進位（對收款方有利）
export function roundFavorReceiver(amount, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.ceil(amount * factor - 1e-9) / factor;
}

export function roundTo(amount, decimals) {
  const factor = Math.pow(10, decimals);
  return Math.round((amount + 1e-9) * factor) / factor;
}

export function computeExpenseShares(expense) {
  const shares = {};
  const total = expense.baseAmount;
  if (expense.splitType === "equal") {
    const n = expense.splitMemberIds.length || 1;
    expense.splitMemberIds.forEach((id) => (shares[id] = total / n));
  } else if (expense.splitType === "ratio") {
    const sumW = expense.splitMemberIds.reduce((s, id) => s + (expense.splitWeights[id] || 0), 0) || 1;
    expense.splitMemberIds.forEach((id) => (shares[id] = (total * (expense.splitWeights[id] || 0)) / sumW));
  } else if (expense.splitType === "custom") {
    const factor = expense.amount > 0 ? total / expense.amount : 0;
    expense.splitMemberIds.forEach((id) => (shares[id] = (expense.splitAmounts[id] || 0) * factor));
  }
  return shares;
}

export function computePayerBaseAmounts(expense) {
  const result = {};
  const factor = expense.amount > 0 ? expense.baseAmount / expense.amount : 0;
  (expense.payers || []).forEach((p) => {
    result[p.memberId] = (result[p.memberId] || 0) + p.amount * factor;
  });
  return result;
}

/**
 * 單筆項目的分攤與付款分配。
 *
 * decimals 是專案的結算位數。分攤金額直接無條件進位到「結算單位」，
 * 而不是固定的小數兩位——否則整數結算的專案會算出 201.34 這種分攤，
 * 結算時再進位成 202 叫人付，付完就多出 0.66 的溢繳，
 * 下次打開結算頁那 0.66 又被進位成整整 1 元（還會冒出假的轉帳建議）。
 * 分攤時就對齊結算單位，餘額全程都是整數，尾差根本不會產生。
 *
 * 付款人拿回的錢，合計必須剛好等於分攤金額的合計，整份帳才會平。
 * 所以除了金額最大的付款人以外各自進位，由他吸收尾差——
 * 若每個付款人各自進位，多人共同付款時合計最多會差 n×0.5，sum(balances) 就不為 0 了。
 */
export function computeItemAllocation(expense, decimals = 2) {
  const rawShares = computeExpenseShares(expense);
  const shares = {};
  let sumRounded = 0;
  Object.entries(rawShares).forEach(([id, v]) => {
    const r = roundFavorReceiver(v, decimals);
    shares[id] = r;
    sumRounded += r;
  });

  const rawCredits = computePayerBaseAmounts(expense);
  const payerIds = Object.keys(rawCredits).sort((a, b) => rawCredits[b] - rawCredits[a]);
  const payerCredits = {};
  let othersSum = 0;
  for (let i = 1; i < payerIds.length; i++) {
    payerCredits[payerIds[i]] = roundTo(rawCredits[payerIds[i]], decimals);
    othersSum += payerCredits[payerIds[i]];
  }
  if (payerIds.length > 0) payerCredits[payerIds[0]] = roundTo(sumRounded - othersSum, decimals);

  return { shares, payerCredits };
}

// 某個人在單一項目裡的個人金額（負數＝花錢，正數＝收錢）。
// 不是該項目的參與者時回傳 null，呼叫端才能選擇不顯示而不是顯示 0。
export function personalItemAmount(item, memberId, decimals = 2) {
  const itemType = item.itemType || "expense";
  if (itemType === "transfer") {
    const amt = roundTo(item.baseAmount, decimals);
    if (item.fromMemberId === memberId) return -amt;
    if (item.toMemberId === memberId) return amt;
    return null;
  }
  const { shares } = computeItemAllocation(item, decimals);
  if (shares[memberId] === undefined) return null;
  return itemType === "collection" ? shares[memberId] : -shares[memberId];
}

export function computeBalances(memberIds, expenses, decimals = 2) {
  const balances = {};
  memberIds.forEach((id) => (balances[id] = 0));
  expenses.forEach((exp) => {
    const itemType = exp.itemType || "expense";
    if (itemType === "transfer") {
      // 轉帳金額也對齊結算單位，才會跟畫面上顯示的數字一致
      const amt = roundTo(exp.baseAmount, decimals);
      balances[exp.fromMemberId] = (balances[exp.fromMemberId] || 0) + amt;
      balances[exp.toMemberId] = (balances[exp.toMemberId] || 0) - amt;
      return;
    }
    const sign = itemType === "collection" ? -1 : 1;
    const { shares, payerCredits } = computeItemAllocation(exp, decimals);
    Object.entries(payerCredits).forEach(([id, amt]) => {
      balances[id] = (balances[id] || 0) + sign * amt;
    });
    Object.entries(shares).forEach(([id, share]) => {
      balances[id] = (balances[id] || 0) - sign * share;
    });
  });
  return balances;
}

export function reconcileBalances(rawBalances, decimals) {
  // 每個欠款人付的錢無條件進位、每個收款人收的錢也無條件進位，
  // 只有金額最大的收款人吸收尾差，確保總和為 0。
  const entries = Object.entries(rawBalances);
  const debtors = entries.filter(([, v]) => v < -EPS).map(([id, v]) => ({ id, amount: roundFavorReceiver(-v, decimals) }));
  const creditors = entries.filter(([, v]) => v > EPS).map(([id, v]) => ({ id, raw: v, amount: roundFavorReceiver(v, decimals) }));
  const totalOwed = debtors.reduce((s, d) => s + d.amount, 0);

  if (creditors.length > 0) {
    creditors.sort((a, b) => b.raw - a.raw);
    const othersSum = creditors.slice(1).reduce((s, c) => s + c.amount, 0);
    creditors[0].amount = roundTo(totalOwed - othersSum, decimals);
  }

  const reconciled = {};
  debtors.forEach((d) => (reconciled[d.id] = -d.amount));
  creditors.forEach((c) => (reconciled[c.id] = c.amount));
  return reconciled;
}

export function simplifyDebts(balances, decimals) {
  const creditors = Object.entries(balances)
    .filter(([, v]) => v > EPS)
    .map(([id, v]) => ({ id, v }));
  const debtors = Object.entries(balances)
    .filter(([, v]) => v < -EPS)
    .map(([id, v]) => ({ id, v: -v }));
  creditors.sort((a, b) => b.v - a.v);
  debtors.sort((a, b) => b.v - a.v);
  const txns = [];
  let ci = 0;
  let di = 0;
  while (ci < creditors.length && di < debtors.length) {
    const c = creditors[ci];
    const d = debtors[di];
    const raw = Math.min(c.v, d.v);
    if (raw > EPS) {
      txns.push({ from: d.id, to: c.id, amount: roundFavorReceiver(raw, decimals) });
    }
    c.v -= raw;
    d.v -= raw;
    if (c.v <= EPS) ci++;
    if (d.v <= EPS) di++;
  }
  return txns;
}

export function oneCollectorSettlement(balances, collectorId, decimals) {
  const txns = [];
  Object.entries(balances).forEach(([id, v]) => {
    if (id === collectorId) return;
    if (v < -EPS) txns.push({ from: id, to: collectorId, amount: roundFavorReceiver(-v, decimals) });
    else if (v > EPS) txns.push({ from: collectorId, to: id, amount: roundFavorReceiver(v, decimals) });
  });
  return txns;
}

/**
 * 誰先墊的錢最多。
 * 「指定一人全收發」的預設收發款人用這個——代墊最多的人本來就要收回最多錢，
 * 由他當窗口，實際會發生的轉帳筆數最少。
 * 平手時取 memberIds 裡排比較前面的，結果才不會每次重算就跳。
 */
export function biggestPrepayer(memberIds, expenses) {
  const paid = {};
  (expenses || []).forEach((e) => {
    if ((e.itemType || "expense") !== "expense") return;
    Object.entries(computePayerBaseAmounts(e)).forEach(([id, v]) => {
      paid[id] = (paid[id] || 0) + v;
    });
  });
  let best = null;
  let bestValue = -Infinity;
  (memberIds || []).forEach((id) => {
    const v = paid[id] || 0;
    if (v > bestValue) {
      bestValue = v;
      best = id;
    }
  });
  return best;
}

// 專案是否已結清
export function isProjectSettled(project, projectExpenses) {
  if (projectExpenses.length === 0) return true;
  const decimals = project.settlementDecimals ?? 0;
  const reconciled = reconcileBalances(computeBalances(project.memberIds, projectExpenses, decimals), decimals);
  return Object.values(reconciled).every((v) => Math.abs(v) < 0.005);
}
