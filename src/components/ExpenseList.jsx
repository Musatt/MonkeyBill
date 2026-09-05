import React, { useState } from "react";
import { CATEGORIES } from "../constants.js";
import { categoryOf, formatMoney, projectDecimals } from "../lib/format.js";
import { personalItemAmount } from "../lib/money.js";

const KIND_LABEL = { expense: "支出", collection: "收入", transfer: "轉帳" };

/** 付款人太多就不一一列出，直接寫人數 */
function payerText(payers, membersById) {
  if (payers.length === 0) return "—";
  if (payers.length > 3) return `付款 ${payers.length} 人`;
  return `付款：${payers.map((p) => membersById[p.memberId]?.name || "?").join("、")}`;
}

export function ExpenseList({ project, expenses, membersById, myId, canDelete, onEdit, onDelete }) {
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [search, setSearch] = useState("");
  const [typeFilterSet, setTypeFilterSet] = useState(() => new Set());
  const [categoryFilterSet, setCategoryFilterSet] = useState(() => new Set());
  const [onlyMine, setOnlyMine] = useState(false);

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

  const hasFilter = typeFilterSet.size > 0 || categoryFilterSet.size > 0 || onlyMine || !!search.trim();
  const clearFilters = () => {
    setTypeFilterSet(new Set());
    setCategoryFilterSet(new Set());
    setOnlyMine(false);
    setSearch("");
  };

  const filteredSpend = sorted
    .filter((e) => (e.itemType || "expense") === "expense")
    .reduce((s, e) => s + e.baseAmount, 0);

  // 依日期分組，日期帶才能各自 sticky
  const groups = [];
  sorted.forEach((e) => {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  });

  const typeFilters = [
    ["expense", "支出"],
    ["collection", "收入"],
    ["transfer", "轉帳"],
  ];

  const renderItem = (e) => {
    const itemType = e.itemType || "expense";
    const isTransfer = itemType === "transfer";
    const cat = isTransfer ? null : categoryOf(e.category);
    const myAmount = personalItemAmount(e, myId, decimals);
    const allowed = canDelete(e.id);
    const confirming = confirmDeleteId === e.id;

    const who = isTransfer
      ? `${membersById[e.fromMemberId]?.name || "?"} → ${membersById[e.toMemberId]?.name || "?"}`
      : payerText(e.payers || [], membersById);
    const splitText = isTransfer
      ? "內部轉帳"
      : `${e.splitType === "equal" ? "均分" : e.splitType === "ratio" ? "比例" : "自訂"} · ${(e.splitMemberIds || []).length} 人`;

    return (
      <div key={e.id} className="item">
        <div className="item-row1">
          <span className={"kind kind-" + itemType}>{KIND_LABEL[itemType]}</span>
          {cat && (
            <span className="cat" style={{ "--cat-color": cat.color }}>
              {cat.label}
            </span>
          )}
          <span className="item-acts">
            {confirming ? (
              <>
                <button className="act" onClick={() => setConfirmDeleteId(null)}>取消</button>
                <button
                  className="act act-confirm"
                  onClick={() => {
                    onDelete(e.id);
                    setConfirmDeleteId(null);
                  }}
                >
                  確定刪除
                </button>
              </>
            ) : (
              <>
                <button className="act" onClick={() => onEdit(e.id)}>編輯</button>
                {allowed.ok ? (
                  <button className="act act-danger" onClick={() => setConfirmDeleteId(e.id)}>刪除</button>
                ) : (
                  <span className="act act-muted" title={allowed.reason}>刪除</span>
                )}
              </>
            )}
          </span>
        </div>

        <div className="item-row2">
          <span className="item-desc">{e.note}</span>
          <span className={"item-amt mono amt-" + itemType}>{formatMoney(e.baseAmount, project.baseCurrency, decimals)}</span>
        </div>

        {myAmount !== null && !isTransfer && (
          <div className={"item-mine mono " + (itemType === "collection" ? "amt-collection" : "amt-expense")}>
            你 {itemType === "collection" ? "分到" : "分攤"} {formatMoney(Math.abs(myAmount), project.baseCurrency, decimals)}
          </div>
        )}

        <div className="item-meta">
          <span className="meta-time mono">{e.time}</span>
          <span className="meta-who">{who}</span>
          <span className="meta-split">{splitText}</span>
        </div>

        {e.currency !== project.baseCurrency && (
          <div className="item-fx mono">
            原始 {formatMoney(e.amount, e.currency)} · 匯率 {Number(e.exchangeRate ?? 1).toFixed(4)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* 篩選：放在內容最上方，選完往下滑就會離開視線，不置頂 */}
      <div className="filter-block">
        <input
          className="input input-search"
          placeholder="搜尋項目說明"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="filter-chip-row">
          {typeFilters.map(([key, label]) => (
            <button
              key={key}
              className={"filter-chip" + (typeFilterSet.has(key) ? " on" : "")}
              onClick={() => toggleTypeFilter(key)}
            >
              {label}
            </button>
          ))}
          <button className={"filter-chip" + (onlyMine ? " on" : "")} onClick={() => setOnlyMine((v) => !v)}>
            只看我的
          </button>
        </div>
        <div className="filter-chip-row">
          {CATEGORIES.map((c) => {
            const active = categoryFilterSet.has(c.id);
            return (
              <button
                key={c.id}
                className={"filter-chip" + (active ? " on-cat" : "")}
                style={active ? { "--cat-color": c.color } : undefined}
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
      </div>

      <div className="band">
        <span>
          共 <span className="band-n">{sorted.length}</span> 筆{hasFilter ? `（全部 ${expenses.length}）` : ""}
        </span>
        <span className="band-side mono">
          支出合計 {formatMoney(filteredSpend, project.baseCurrency, decimals)}
        </span>
      </div>

      {groups.map((g) => (
        <div key={g.date}>
          <div className="band band-sticky band-day">
            <span className="band-n">{g.date}</span>
            <span className="band-side">{g.items.length} 筆</span>
          </div>
          <div className="item-group">{g.items.map(renderItem)}</div>
        </div>
      ))}

      {sorted.length === 0 && (
        <div className="empty-hint" style={{ marginTop: 14 }}>
          {expenses.length === 0 ? "還沒有項目，按右下角的 ＋ 新增第一筆" : "沒有符合條件的項目"}
        </div>
      )}
    </div>
  );
}
