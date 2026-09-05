import React, { useState, useMemo } from "react";
import { CATEGORIES } from "../constants.js";
import { formatMoney, formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances, computeItemAllocation } from "../lib/money.js";

const sortByDateDesc = (arr) => [...arr].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

function emptyCategoryMap(value) {
  const map = {};
  CATEGORIES.forEach((c) => (map[c.id] = typeof value === "function" ? value() : value));
  return map;
}

/** 大數字面板：一個主角數字，底下掛幾個補充數據 */
function StatPanel({ label, value, tone, facts, note }) {
  return (
    <div className="stat-panel">
      <div className="stat-panel-label">{label}</div>
      <div className={"stat-panel-value mono" + (tone ? " " + tone : "")}>{value}</div>
      {note && <div className="stat-panel-note">{note}</div>}
      {facts && facts.length > 0 && (
        <div className="stat-facts">
          {facts.map((f) => (
            <div key={f.label} className="stat-fact">
              <div className="stat-fact-label">{f.label}</div>
              <div className="stat-fact-value mono">{f.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 分類佔比。
 * 上面一條堆疊條把比例一次講完，下面才是可以展開的明細列——
 * 比原本六條各自為政的長條更快看出「錢主要花在哪」。
 */
function Composition({ amounts, itemsByCategory, currency, decimals, getAmount, signPrefix }) {
  const [expanded, setExpanded] = useState(null);

  const rows = CATEGORIES.map((c) => ({ ...c, amount: amounts[c.id] || 0 })).filter((r) => r.amount > 0.0000001);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  rows.sort((a, b) => b.amount - a.amount);

  if (rows.length === 0) return <div className="empty-hint">還沒有紀錄</div>;

  return (
    <div className="composition">
      <div className="comp-bar" role="img" aria-label="分類佔比">
        {rows.map((r) => (
          <span
            key={r.id}
            className="comp-seg"
            style={{ width: `${(r.amount / total) * 100}%`, background: r.color }}
            title={`${r.label} ${Math.round((r.amount / total) * 100)}%`}
          />
        ))}
      </div>

      <div className="comp-list">
        {rows.map((r) => {
          const items = itemsByCategory[r.id] || [];
          const pct = Math.round((r.amount / total) * 100);
          const open = expanded === r.id;
          return (
            <div key={r.id}>
              <button
                type="button"
                className={"comp-row" + (open ? " comp-row-open" : "")}
                onClick={() => setExpanded(open ? null : r.id)}
                disabled={items.length === 0}
                aria-expanded={open}
              >
                <span className="comp-dot" style={{ background: r.color }} />
                <span className="comp-name">{r.label}</span>
                <span className="comp-count">{items.length} 筆</span>
                <span className="comp-pct mono" style={{ color: r.color }}>{pct}%</span>
                <span className="comp-amt mono">{formatMoney(r.amount, currency, decimals)}</span>
              </button>
              {open && (
                <div className="comp-items">
                  {items.map((item) => {
                    const amt = getAmount(item);
                    return (
                      <div key={item.id} className="comp-item">
                        <span className="comp-item-note">{item.note}</span>
                        <span className="comp-item-date mono">{item.date}</span>
                        <span className="comp-item-amt mono">
                          {signPrefix}
                          {formatMoney(Math.abs(amt), currency, decimals)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StatsPage({ project, expenses, membersById, myId }) {
  const [tab, setTab] = useState("group");
  const decimals = projectDecimals(project);
  const fallbackMemberId = project.memberIds.includes(myId) ? myId : project.memberIds[0];
  const [pickedMemberId, setPickedMemberId] = useState(fallbackMemberId);
  const viewMemberId = project.memberIds.includes(pickedMemberId) ? pickedMemberId : fallbackMemberId;
  const isSelf = viewMemberId === myId;

  const spendingExpenses = useMemo(() => expenses.filter((e) => (e.itemType || "expense") === "expense"), [expenses]);
  const collectionExpenses = useMemo(() => expenses.filter((e) => e.itemType === "collection"), [expenses]);
  const transfers = useMemo(() => expenses.filter((e) => e.itemType === "transfer"), [expenses]);

  const totalSpend = spendingExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const totalCollected = collectionExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const headcount = project.memberIds.length || 1;

  const groupBuckets = useMemo(() => {
    const build = (items) => {
      const amounts = emptyCategoryMap(0);
      const lists = emptyCategoryMap(() => []);
      items.forEach((e) => {
        const key = amounts[e.category] !== undefined ? e.category : "other";
        amounts[key] += e.baseAmount;
        lists[key].push(e);
      });
      Object.keys(lists).forEach((k) => (lists[k] = sortByDateDesc(lists[k])));
      return { amounts, lists };
    };
    return { spend: build(spendingExpenses), collect: build(collectionExpenses) };
  }, [spendingExpenses, collectionExpenses]);

  const rawBalances = useMemo(() => computeBalances(project.memberIds, expenses, decimals), [project.memberIds, expenses, decimals]);
  const balances = useMemo(() => reconcileBalances(rawBalances, decimals), [rawBalances, decimals]);

  const personal = useMemo(() => {
    const build = (items) => {
      const amounts = emptyCategoryMap(0);
      const lists = emptyCategoryMap(() => []);
      let total = 0;
      items.forEach((e) => {
        const { shares } = computeItemAllocation(e, decimals);
        const share = shares[viewMemberId];
        if (share === undefined) return;
        const key = amounts[e.category] !== undefined ? e.category : "other";
        amounts[key] += share;
        lists[key].push(e);
        total += share;
      });
      Object.keys(lists).forEach((k) => (lists[k] = sortByDateDesc(lists[k])));
      return { amounts, lists, total };
    };
    // 他實際先墊出去的錢
    let paidOut = 0;
    spendingExpenses.forEach((e) => {
      const { payerCredits } = computeItemAllocation(e, decimals);
      paidOut += payerCredits[viewMemberId] || 0;
    });
    return {
      spend: build(spendingExpenses),
      collect: build(collectionExpenses),
      paidOut,
      net: balances[viewMemberId] || 0,
    };
  }, [viewMemberId, spendingExpenses, collectionExpenses, balances, decimals]);

  const netSettled = Math.abs(personal.net) < 0.005;
  const who = membersById[viewMemberId]?.name || "?";
  const subject = isSelf ? "你" : who;

  return (
    <div className="stats">
      <div className="mode-switch">
        <button className={tab === "group" ? "on" : ""} onClick={() => setTab("group")}>團體統計</button>
        <button className={tab === "personal" ? "on" : ""} onClick={() => setTab("personal")}>個人統計</button>
      </div>

      {tab === "group" ? (
        <>
          <StatPanel
            label="專案總支出"
            value={formatMoney(totalSpend, project.baseCurrency, decimals)}
            facts={[
              { label: "筆數", value: `${spendingExpenses.length} 筆` },
              { label: "參與人數", value: `${headcount} 人` },
              { label: "平均每人", value: formatMoney(totalSpend / headcount, project.baseCurrency, decimals) },
            ]}
            note="不含收入與轉帳項目"
          />

          <div className="stat-head">分類佔比</div>
          <Composition
            amounts={groupBuckets.spend.amounts}
            itemsByCategory={groupBuckets.spend.lists}
            currency={project.baseCurrency}
            decimals={decimals}
            getAmount={(item) => item.baseAmount}
            signPrefix=""
          />

          {totalCollected > 0 && (
            <>
              <div className="stat-head">收入</div>
              <StatPanel
                label="收入總額"
                value={formatMoney(totalCollected, project.baseCurrency, decimals)}
                tone="text-pos"
                facts={[{ label: "筆數", value: `${collectionExpenses.length} 筆` }]}
              />
              <Composition
                amounts={groupBuckets.collect.amounts}
                itemsByCategory={groupBuckets.collect.lists}
                currency={project.baseCurrency}
                decimals={decimals}
                getAmount={(item) => item.baseAmount}
                signPrefix="+"
              />
            </>
          )}

          {transfers.length > 0 && (
            <div className="stat-aside">
              另有 <b>{transfers.length}</b> 筆轉帳（還款、內部搬錢），不列入總支出。
            </div>
          )}
        </>
      ) : (
        <>
          <div className="picker-row">
            <span className="picker-row-label">查看對象</span>
            <select className="input picker-row-select" value={viewMemberId} onChange={(e) => setPickedMemberId(e.target.value)}>
              {project.memberIds.map((id) => (
                <option key={id} value={id}>
                  {membersById[id]?.name || "?"}
                  {id === myId ? "（你）" : ""}
                </option>
              ))}
            </select>
          </div>

          <StatPanel
            label={`${subject}的淨額`}
            value={formatSigned(personal.net, project.baseCurrency, decimals)}
            tone={personal.net > 0.005 ? "text-pos" : personal.net < -0.005 ? "text-neg" : ""}
            note={netSettled ? "已結清" : personal.net > 0 ? `別人該還${subject}這麼多` : `${subject}該還別人這麼多`}
            facts={[
              { label: "分攤到的支出", value: formatMoney(personal.spend.total, project.baseCurrency, decimals) },
              { label: "先墊出去的", value: formatMoney(personal.paidOut, project.baseCurrency, decimals) },
              { label: "分到的收入", value: formatMoney(personal.collect.total, project.baseCurrency, decimals) },
            ]}
          />

          <div className="stat-head">{subject}的支出分類</div>
          <Composition
            amounts={personal.spend.amounts}
            itemsByCategory={personal.spend.lists}
            currency={project.baseCurrency}
            decimals={decimals}
            getAmount={(item) => computeItemAllocation(item, decimals).shares[viewMemberId] || 0}
            signPrefix=""
          />

          {personal.collect.total > 0 && (
            <>
              <div className="stat-head">{subject}的收入分類</div>
              <Composition
                amounts={personal.collect.amounts}
                itemsByCategory={personal.collect.lists}
                currency={project.baseCurrency}
                decimals={decimals}
                getAmount={(item) => computeItemAllocation(item, decimals).shares[viewMemberId] || 0}
                signPrefix="+"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
