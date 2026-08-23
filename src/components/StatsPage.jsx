import React, { useState, useMemo } from "react";
import { CATEGORIES } from "../constants.js";
import { formatMoney, formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances, computeItemAllocation } from "../lib/money.js";
import { CategoryBarList } from "./primitives.jsx";

const sortByDateDesc = (arr) => [...arr].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

function emptyCategoryMap(value) {
  const map = {};
  CATEGORIES.forEach((c) => (map[c.id] = typeof value === "function" ? value() : value));
  return map;
}

export function StatsPage({ project, expenses, membersById, myId }) {
  const [tab, setTab] = useState("group");
  const decimals = projectDecimals(project);
  const fallbackMemberId = project.memberIds.includes(myId) ? myId : project.memberIds[0];
  const [pickedMemberId, setPickedMemberId] = useState(fallbackMemberId);
  // 成員被移出專案後，選單值會失效，退回一個仍在名單上的人
  const viewMemberId = project.memberIds.includes(pickedMemberId) ? pickedMemberId : fallbackMemberId;

  const spendingExpenses = useMemo(() => expenses.filter((e) => (e.itemType || "expense") === "expense"), [expenses]);
  const collectionExpenses = useMemo(() => expenses.filter((e) => e.itemType === "collection"), [expenses]);

  const totalSpend = spendingExpenses.reduce((s, e) => s + e.baseAmount, 0);
  const totalCollected = collectionExpenses.reduce((s, e) => s + e.baseAmount, 0);

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

  const rawBalances = useMemo(() => computeBalances(project.memberIds, expenses), [project.memberIds, expenses]);
  const balances = useMemo(() => reconcileBalances(rawBalances, decimals), [rawBalances, decimals]);

  const personal = useMemo(() => {
    const build = (items) => {
      const amounts = emptyCategoryMap(0);
      const lists = emptyCategoryMap(() => []);
      let total = 0;
      items.forEach((e) => {
        const { shares } = computeItemAllocation(e);
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
    return {
      spend: build(spendingExpenses),
      collect: build(collectionExpenses),
      net: balances[viewMemberId] || 0,
    };
  }, [viewMemberId, spendingExpenses, collectionExpenses, balances]);

  const netSettled = Math.abs(personal.net) < 0.005;

  return (
    <div className="screen">
      <div className="mode-switch">
        <button className={tab === "group" ? "on" : ""} onClick={() => setTab("group")}>團體統計</button>
        <button className={tab === "personal" ? "on" : ""} onClick={() => setTab("personal")}>個人統計</button>
      </div>

      {tab === "group" ? (
        <>
          <div className="stat-hero">
            <div className="stat-hero-label">專案總花費</div>
            <div className="stat-hero-value mono">{formatMoney(totalSpend, project.baseCurrency, decimals)}</div>
            <div className="hint-text">不含收入與轉帳項目</div>
          </div>

          <div className="section-label">分類佔比</div>
          <CategoryBarList
            byCategory={groupBuckets.spend.amounts}
            itemsByCategory={groupBuckets.spend.lists}
            currency={project.baseCurrency}
            decimals={decimals}
            getAmount={(item) => -item.baseAmount}
            colorize
          />

          {totalCollected > 0 && (
            <>
              <div className="stat-hero" style={{ marginTop: 20 }}>
                <div className="stat-hero-label">收入總額</div>
                <div className="stat-hero-value mono">{formatMoney(totalCollected, project.baseCurrency, decimals)}</div>
              </div>
              <div className="section-label">收入分類佔比</div>
              <CategoryBarList
                byCategory={groupBuckets.collect.amounts}
                itemsByCategory={groupBuckets.collect.lists}
                currency={project.baseCurrency}
                decimals={decimals}
                getAmount={(item) => item.baseAmount}
                colorize
              />
            </>
          )}
        </>
      ) : (
        <>
          <div className="section-label">查看對象</div>
          <select className="input" value={viewMemberId} onChange={(e) => setPickedMemberId(e.target.value)}>
            {project.memberIds.map((id) => (
              <option key={id} value={id}>{membersById[id]?.name || "?"}</option>
            ))}
          </select>

          <div className="stat-hero" style={{ marginTop: 12 }}>
            <div className="stat-hero-label">目前淨額</div>
            <div className={"stat-hero-value mono" + (personal.net > 0.005 ? " text-pos" : personal.net < -0.005 ? " text-neg" : "")}>
              {formatSigned(personal.net, project.baseCurrency, decimals)}
            </div>
            <div className="hint-text">
              {netSettled ? "已結清" : personal.net > 0 ? "別人該還他這麼多" : "他該還別人這麼多"}
            </div>
          </div>

          <div className="row-2" style={{ marginTop: 10 }}>
            <div className="mini-card">
              <div className="mini-card-label">分攤到的花費</div>
              <div className="mini-card-value mono">{formatMoney(personal.spend.total, project.baseCurrency, decimals)}</div>
            </div>
            <div className="mini-card">
              <div className="mini-card-label">分到的收入</div>
              <div className="mini-card-value mono">{formatMoney(personal.collect.total, project.baseCurrency, decimals)}</div>
            </div>
          </div>

          <div className="section-label" style={{ marginTop: 16 }}>個人分類支出</div>
          <CategoryBarList
            byCategory={personal.spend.amounts}
            itemsByCategory={personal.spend.lists}
            currency={project.baseCurrency}
            decimals={decimals}
            getAmount={(item) => -(computeItemAllocation(item).shares[viewMemberId] || 0)}
            colorize
          />

          {personal.collect.total > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 16 }}>個人分類收入</div>
              <CategoryBarList
                byCategory={personal.collect.amounts}
                itemsByCategory={personal.collect.lists}
                currency={project.baseCurrency}
                decimals={decimals}
                getAmount={(item) => computeItemAllocation(item).shares[viewMemberId] || 0}
                colorize
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
