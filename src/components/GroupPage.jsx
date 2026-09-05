import React, { useState } from "react";
import { todayStr } from "../lib/format.js";
import { isProjectSettled } from "../lib/money.js";
import { isPickable } from "../lib/permissions.js";
import { DatePickerBox, CurrencySelect } from "./primitives.jsx";

export function GroupPage({
  group,
  users,
  projects,
  expenses,
  myId,
  isAdmin,
  onBack,
  onOpenProject,
  onCreateProject,
  onOpenMember,
  onOpenSettings,
  onOpenMembers,
  onShare,
}) {
  const admins = new Set(group.adminIds || []);
  const activeMembers = group.memberIds.map((id) => users[id]).filter((u) => isPickable(u, group));

  const [showNew, setShowNew] = useState(false);
  const [pname, setPname] = useState("");
  const [pdesc, setPdesc] = useState("");
  const [pdate, setPdate] = useState(() => todayStr());
  const [selected, setSelected] = useState(() => new Set(activeMembers.map((m) => m.id)));
  const [currency, setCurrency] = useState("TWD");
  const [settlementDecimals, setSettlementDecimals] = useState(0);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sortedProjects = [...projects].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  return (
    <div className="screen">
      <div className="topbar">
        <button className="backbtn" onClick={onBack} aria-label="返回">‹</button>
        <div className="topbar-text">
          <div className="topbar-title">{group.name}</div>
          {group.description && <div className="topbar-sub">{group.description}</div>}
          <div className="topbar-sub">
            你是 {users[myId]?.name || "?"}
            {isAdmin && <span className="admin-tag">管理者</span>}
          </div>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="edit-icon-btn" onClick={onShare}>🔗 分享</button>
        {isAdmin && <button className="edit-icon-btn" onClick={onOpenMembers}>管理成員</button>}
        {isAdmin && <button className="edit-icon-btn" onClick={onOpenSettings}>編輯</button>}
      </div>

      <div className="section-label">成員（{activeMembers.length}）</div>
      <div className="member-chip-row">
        {activeMembers.map((m) => (
          <button
            key={m.id}
            className={"member-tag selectable" + (m.id === myId ? " member-tag-me" : "")}
            onClick={() => onOpenMember(m.id)}
          >
            {m.name}
            {admins.has(m.id) && <span className="admin-dot" title="管理者">•</span>}
          </button>
        ))}
      </div>
      {!isAdmin && <div className="hint-text">要增減成員請找群組管理者。</div>}

      <div className="section-label" style={{ marginTop: 20 }}>專案</div>
      <div className="list-stack">
        {sortedProjects.map((p) => {
          const projectExpenses = expenses.filter((e) => e.projectId === p.id);
          const settled = isProjectSettled(p, projectExpenses);
          const inProject = p.memberIds.includes(myId);
          return (
            <button key={p.id} className="project-card" onClick={() => onOpenProject(p.id)}>
              <div className="project-card-top">
                <div className="project-card-name">{p.name}</div>
                <span className={"settle-badge" + (settled ? " settled" : "")}>{settled ? "已結清" : "未結清"}</span>
              </div>
              {p.description && <div className="card-desc">{p.description}</div>}
              <div className="project-card-meta">
                {p.date || "—"} · {p.memberIds.length} 人 · {projectExpenses.length} 筆 · 主幣別 {p.baseCurrency}
                {!inProject && <span className="hint-text"> · 你不在這個專案</span>}
              </div>
            </button>
          );
        })}
        {projects.length === 0 && <div className="empty-hint">還沒有專案</div>}
      </div>

      {!showNew ? (
        <button
          className="btn-outline full-width"
          style={{ marginTop: 16 }}
          onClick={() => {
            setSelected(new Set(activeMembers.map((m) => m.id)));
            setShowNew(true);
          }}
        >
          ＋ 新增專案
        </button>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-label">專案名稱</div>
          <input className="input" value={pname} onChange={(e) => setPname(e.target.value)} placeholder="例如：822軒銘家" autoFocus />
          <div className="section-label" style={{ marginTop: 12 }}>說明（選填）</div>
          <textarea className="input textarea" value={pdesc} onChange={(e) => setPdesc(e.target.value)} placeholder="這個專案是做什麼用的" />
          <div className="section-label" style={{ marginTop: 12 }}>專案日期</div>
          <DatePickerBox value={pdate} onChange={setPdate} />
          <div className="section-label" style={{ marginTop: 12 }}>參加成員（{selected.size}）</div>
          <div className="member-chip-row">
            {activeMembers.map((m) => (
              <button
                key={m.id}
                className={"member-tag selectable" + (selected.has(m.id) ? " member-tag-on" : "")}
                onClick={() => toggle(m.id)}
              >
                {m.name}
              </button>
            ))}
          </div>
          <div className="section-label" style={{ marginTop: 12 }}>主幣別</div>
          <CurrencySelect value={currency} onChange={setCurrency} />
          <div className="section-label" style={{ marginTop: 12 }}>金額顯示與結算位數</div>
          <div className="mode-switch mode-switch-3">
            <button className={settlementDecimals === 0 ? "on" : ""} onClick={() => setSettlementDecimals(0)}>整數</button>
            <button className={settlementDecimals === 1 ? "on" : ""} onClick={() => setSettlementDecimals(1)}>小數1位</button>
            <button className={settlementDecimals === 2 ? "on" : ""} onClick={() => setSettlementDecimals(2)}>小數2位</button>
          </div>
          <div className="hint-text">這個專案裡所有 {currency || "主幣別"} 金額都會用這個位數顯示與結算。</div>
          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setShowNew(false)}>取消</button>
            <button
              className="btn-accent"
              disabled={!pname.trim() || selected.size === 0 || !currency.trim()}
              onClick={() => {
                onCreateProject(pname.trim(), pdesc.trim(), Array.from(selected), currency.trim(), settlementDecimals, pdate);
                setShowNew(false);
                setPname("");
                setPdesc("");
                setPdate(todayStr());
              }}
            >
              建立專案
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
