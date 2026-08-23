import React, { useState } from "react";
import { todayStr, findMemberByName } from "../lib/format.js";
import { isProjectSettled } from "../lib/money.js";
import { DatePickerBox, CurrencySelect } from "./primitives.jsx";

export function GroupPage({
  group,
  projects,
  expenses,
  myId,
  onBack,
  onOpenProject,
  onCreateProject,
  onAddMember,
  onReviveMember,
  onOpenMember,
  onOpenSettings,
  onShare,
  onSwitchIdentity,
}) {
  const activeMembers = group.members.filter((m) => !m.deleted);
  const [showNew, setShowNew] = useState(false);
  const [pname, setPname] = useState("");
  const [pdesc, setPdesc] = useState("");
  const [pdate, setPdate] = useState(() => todayStr());
  const [selected, setSelected] = useState(() => new Set(activeMembers.map((m) => m.id)));
  const [currency, setCurrency] = useState("TWD");
  const [settlementDecimals, setSettlementDecimals] = useState(0);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const me = group.members.find((m) => m.id === myId);
  const newTrimmed = newMemberName.trim();
  const newMatch = newTrimmed ? findMemberByName(group.members, newTrimmed) : null;
  const newClashesActive = newMatch && !newMatch.deleted;
  const newCanRevive = newMatch && newMatch.deleted;

  const sortedProjects = [...projects].sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const closeAddMember = () => {
    setNewMemberName("");
    setShowAddMember(false);
  };

  return (
    <div className="screen">
      <div className="topbar">
        <button className="backbtn" onClick={onBack} aria-label="返回">‹</button>
        <div className="topbar-text">
          <div className="topbar-title">
            {group.name}
            {group.password && " 🔒"}
          </div>
          {group.description && <div className="topbar-sub">{group.description}</div>}
          {me && (
            <div className="topbar-sub">
              你是 {me.name} · <button className="link-btn" onClick={onSwitchIdentity}>切換身分</button>
            </div>
          )}
        </div>
      </div>
      <div className="topbar-actions">
        <button className="edit-icon-btn" onClick={onShare}>🔗 分享</button>
        <button className="edit-icon-btn" onClick={onOpenSettings}>編輯</button>
      </div>

      <div className="section-label">成員 ({activeMembers.length})</div>
      <div className="member-chip-row">
        {activeMembers.map((m) => (
          <button
            key={m.id}
            className={"member-tag selectable" + (m.id === myId ? " member-tag-me" : "")}
            onClick={() => onOpenMember(m.id)}
          >
            {m.name}
          </button>
        ))}
        {!showAddMember && (
          <button className="member-tag member-tag-add" onClick={() => setShowAddMember(true)} aria-label="新增成員">
            ＋
          </button>
        )}
      </div>
      {showAddMember && (
        <div style={{ marginTop: 8 }}>
          <div className="row-form">
            <input
              className="input"
              placeholder="新成員名字"
              value={newMemberName}
              onChange={(e) => setNewMemberName(e.target.value)}
              autoFocus
            />
            <button
              className="btn-accent"
              disabled={!newTrimmed || !!newMatch}
              onClick={() => {
                onAddMember(newTrimmed);
                closeAddMember();
              }}
            >
              新增
            </button>
          </div>
          {newClashesActive && <div className="hint-text hint-warn">名單上已經有「{newTrimmed}」了。</div>}
          {newCanRevive && (
            <div className="card subtle" style={{ marginTop: 8 }}>
              <div className="hint-text">
                「{newTrimmed}」之前被刪除過。復原之後他過去的紀錄會重新接回同一個人。
              </div>
              <button
                className="btn-accent full-width"
                style={{ marginTop: 10 }}
                onClick={() => {
                  onReviveMember(newMatch.id);
                  closeAddMember();
                }}
              >
                復原「{newTrimmed}」
              </button>
            </div>
          )}
          <button className="link-btn" style={{ marginTop: 8 }} onClick={closeAddMember}>取消</button>
        </div>
      )}

      <div className="section-label" style={{ marginTop: 20 }}>專案</div>
      <div className="list-stack">
        {sortedProjects.map((p) => {
          const projectExpenses = expenses.filter((e) => e.projectId === p.id);
          const settled = isProjectSettled(p, projectExpenses);
          return (
            <button key={p.id} className="project-card" onClick={() => onOpenProject(p.id)}>
              <div className="project-card-top">
                <div className="project-card-name">{p.name}</div>
                <span className={"settle-badge" + (settled ? " settled" : "")}>{settled ? "已結清" : "未結清"}</span>
              </div>
              {p.description && <div className="card-desc">{p.description}</div>}
              <div className="project-card-meta">
                {p.date || "—"} · {p.memberIds.length} 人 · {projectExpenses.length} 筆 · 主幣別 {p.baseCurrency}
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
          <div className="section-label" style={{ marginTop: 12 }}>參加成員 ({selected.size})</div>
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
