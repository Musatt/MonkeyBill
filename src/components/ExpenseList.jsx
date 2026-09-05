import React, { useState } from "react";
import { CATEGORIES } from "../constants.js";
import { categoryOf, formatMoney, projectDecimals } from "../lib/format.js";
import { personalItemAmount } from "../lib/money.js";
import { Chip } from "./primitives.jsx";

function sanitizeFilename(s) {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "專案";
}

export function exportCSV(project, expenses, membersById) {
  const header = ["日期", "時間", "類型", "類別", "說明", "原始金額", "原始幣別", "匯率", `金額(${project.baseCurrency})`, "付款人/收款人", "分帳方式", "參與人數"];
  const rows = expenses.map((e) => {
    const itemType = e.itemType || "expense";
    if (itemType === "transfer") {
      return [
        e.date, e.time, "轉帳", "", e.note,
        e.amount, e.currency, e.exchangeRate ?? 1, e.baseAmount,
        `${membersById[e.fromMemberId]?.name || "?"}→${membersById[e.toMemberId]?.name || "?"}`,
        "", "",
      ];
    }
    const payerNames = (e.payers || []).map((p) => membersById[p.memberId]?.name || "?").join("、");
    const typeLabelStr = itemType === "collection" ? "收入" : "支出";
    const splitLabelStr = e.splitType === "equal" ? "均分" : e.splitType === "ratio" ? "比例" : "自訂";
    return [
      e.date, e.time, typeLabelStr, categoryOf(e.category).label, e.note,
      e.amount, e.currency, e.exchangeRate ?? 1, e.baseAmount,
      payerNames, splitLabelStr, (e.splitMemberIds || []).length,
    ];
  });
  const csvLines = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
  const csv = "﻿" + csvLines.join("\r\n");
  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(project.name)}-項目紀錄.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export function ExpenseList({ project, expenses, membersById, myId, canDelete, onAdd, onEdit, onDelete, onDuplicate }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilterSet, setTypeFilterSet] = useState(() => new Set()); // 空的代表全部
  const [categoryFilterSet, setCategoryFilterSet] = useState(() => new Set());
  const [onlyMine, setOnlyMine] = useState(false);
  const [exportError, setExportError] = useState("");

  const decimals = projectDecimals(project);

  const toggleIn = (setter) => (key) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const toggleTypeFilter = toggleIn(setTypeFilterSet);
  const toggleCategoryFilter = toggleIn(setCategoryFilterSet);

  const involvesMe = (e) => {
    const itemType = e.itemType || "expense";
    if (itemType === "transfer") return e.fromMemberId === myId || e.toMemberId === myId;
    return (e.payers || []).some((p) => p.memberId === myId) || (e.splitMemberIds || []).includes(myId);
  };

  const filtered = expenses.filter((e) => {
    const itemType = e.itemType || "expense";
    if (typeFilterSet.size > 0 && !typeFilterSet.has(itemType)) return false;
    if (categoryFilterSet.size > 0) {
      if (itemType === "transfer") return false;
      if (!categoryFilterSet.has(e.category)) return false;
    }
    if (onlyMine && !involvesMe(e)) return false;
    if (search.trim() && !(e.note || "").toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });
  const sorted = [...filtered].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));

  const hasFilter = typeFilterSet.size > 0 || categoryFilterSet.size > 0 || onlyMine || search.trim();
  const clearFilters = () => {
    setTypeFilterSet(new Set());
    setCategoryFilterSet(new Set());
    setOnlyMine(false);
    setSearch("");
  };

  // 篩選結果的支出合計（收入與轉帳不計入，跟統計頁的口徑一致）
  const filteredSpend = sorted
    .filter((e) => (e.itemType || "expense") === "expense")
    .reduce((s, e) => s + e.baseAmount, 0);

  const actionRow = (id) => {
    const allowed = canDelete(id);
    return confirmDeleteId === id ? (
      <div className="receipt-actions">
        <button className="del-btn" onClick={() => setConfirmDeleteId(null)}>取消</button>
        <button
          className="del-btn del-btn-confirm"
          onClick={() => {
            onDelete(id);
            setConfirmDeleteId(null);
          }}
        >
          確定刪除
        </button>
      </div>
    ) : (
      <div className="receipt-actions">
        <button className="del-btn" onClick={() => onDuplicate(id)}>複製</button>
        <button className="del-btn" onClick={() => onEdit(id)}>編輯</button>
        {allowed.ok ? (
          <button className="del-btn del-btn-danger" onClick={() => setConfirmDeleteId(id)}>刪除</button>
        ) : (
          <span className="del-btn del-btn-muted" title={allowed.reason}>刪除</span>
        )}
      </div>
    );
  };

  const typeFilters = [
    ["expense", "支出"],
    ["collection", "收入"],
    ["transfer", "轉帳"],
  ];

  let lastDate = null;

  return (
    <div className="screen">
      <div className="row-form">
        <button className="btn-accent" style={{ flex: 1 }} onClick={onAdd}>＋ 新增項目</button>
        <button
          className="btn-ghost"
          style={{ flex: "0 0 auto" }}
          onClick={() => setExportError(exportCSV(project, expenses, membersById) ? "" : "匯出失敗，可能是瀏覽器擋下了下載")}
        >
          匯出 CSV
        </button>
      </div>
      {exportError && <div className="hint-text hint-warn">{exportError}</div>}

      <input
        className="input"
        style={{ marginTop: 10 }}
        placeholder="搜尋項目說明"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="filter-chip-row">
        {typeFilters.map(([key, label]) => (
          <button key={key} className={"filter-chip" + (typeFilterSet.has(key) ? " on" : "")} onClick={() => toggleTypeFilter(key)}>
            {label}
          </button>
        ))}
        <button className={"filter-chip" + (onlyMine ? " on" : "")} onClick={() => setOnlyMine((v) => !v)}>
          只看我的
        </button>
      </div>
      <div className="filter-chip-row" style={{ marginTop: 6 }}>
        {CATEGORIES.map((c) => {
          const active = categoryFilterSet.has(c.id);
          return (
            <button
              key={c.id}
              className="filter-chip"
              style={active ? { background: `${c.color}22`, borderColor: `${c.color}55`, color: c.color, fontWeight: 700 } : undefined}
              onClick={() => toggleCategoryFilter(c.id)}
            >
              {c.label}
            </button>
          );
        })}
        {hasFilter && (
          <button className="filter-clear" onClick={clearFilters}>清除篩選</button>
        )}
      </div>
      <div className="list-summary">
        <span>共 {sorted.length} 筆{hasFilter ? `（全部 ${expenses.length} 筆）` : ""}</span>
        <span className="mono list-summary-total">支出合計 {formatMoney(filteredSpend, project.baseCurrency, decimals)}</span>
      </div>

      <div className="receipt-list">
        {sorted.map((e) => {
          const showHeader = e.date !== lastDate;
          lastDate = e.date;
          const itemType = e.itemType || "expense";

          if (itemType === "transfer") {
            return (
              <React.Fragment key={e.id}>
                {showHeader && <div className="date-group-header">{e.date}</div>}
                <div className="receipt-item">
                  <div className="receipt-top">
                    <Chip color="#9AA3AF">轉帳</Chip>
                    {actionRow(e.id)}
                  </div>
                  <div className="receipt-mid">
                    <div className="receipt-note">{e.note}</div>
                    <div className="receipt-amount mono">{formatMoney(e.baseAmount, project.baseCurrency, decimals)}</div>
                  </div>
                  <div className="receipt-fx mono">
                    {membersById[e.fromMemberId]?.name || "?"} → {membersById[e.toMemberId]?.name || "?"}
                  </div>
                  <div className="receipt-bottom">
                    <span>{e.time}</span>
                  </div>
                </div>
              </React.Fragment>
            );
          }

          const cat = categoryOf(e.category);
          const payers = e.payers || [];
          const isCollection = itemType === "collection";
          const myAmount = personalItemAmount(e, myId, decimals);
          const payerVerb = isCollection ? "收款" : "付款";
          // 單一付款人時金額就是總額，不必再重複一次數字
          const payerText =
            payers.length === 1
              ? membersById[payers[0].memberId]?.name || "?"
              : payers.map((p) => `${membersById[p.memberId]?.name || "?"} ${formatMoney(p.amount, e.currency, decimals)}`).join("・");

          return (
            <React.Fragment key={e.id}>
              {showHeader && <div className="date-group-header">{e.date}</div>}
              <div className="receipt-item">
                <div className="receipt-top">
                  <div style={{ display: "flex", gap: 6 }}>
                    <Chip color={cat.color}>{cat.label}</Chip>
                    {isCollection && <Chip color="var(--accent-2)">收入</Chip>}
                  </div>
                  {actionRow(e.id)}
                </div>
                <div className="receipt-mid">
                  <div className="receipt-note">{e.note}</div>
                  <div className="receipt-amount mono">{formatMoney(e.baseAmount, project.baseCurrency, decimals)}</div>
                </div>
                {e.currency !== project.baseCurrency && (
                  <div className="receipt-fx mono">
                    原始 {formatMoney(e.amount, e.currency)} · 匯率 {Number(e.exchangeRate ?? 1).toFixed(4)}
                  </div>
                )}
                <div className="receipt-fx">
                  {payerVerb}：<span className="mono">{payerText}</span>
                </div>
                {myAmount !== null && (
                  <div className={"receipt-shares mono" + (myAmount < 0 ? " text-neg" : " text-pos")}>
                    {membersById[myId]?.name || "你"}
                    {isCollection ? " 分到 " : " 分攤 "}
                    {formatMoney(Math.abs(myAmount), project.baseCurrency, decimals)}
                  </div>
                )}
                <div className="receipt-bottom">
                  <span>{e.time}</span>
                  <span>
                    {e.splitType === "equal" ? "均分" : e.splitType === "ratio" ? "比例" : "自訂"} · {(e.splitMemberIds || []).length} 人
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {sorted.length === 0 && (
          <div className="empty-hint">{expenses.length === 0 ? "還沒有項目，新增第一筆吧" : "沒有符合條件的項目"}</div>
        )}
      </div>
    </div>
  );
}
