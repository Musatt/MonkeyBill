import React, { useState } from "react";
import { MASTER_PASSWORD } from "../constants.js";
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
  onUpdateGroup,
  onSwitchIdentity,
  onSetPassword,
  onRemovePassword,
  onDeleteGroup,
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
  const [editingGroup, setEditingGroup] = useState(false);
  const [gname, setGname] = useState(group.name);
  const [gdesc, setGdesc] = useState(group.description || "");
  const [pwMode, setPwMode] = useState("view"); // 'view' | 'set' | 'change' | 'remove'
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwCheck, setPwCheck] = useState("");
  const [pwCheckError, setPwCheckError] = useState(false);
  const [confirmingGroupDelete, setConfirmingGroupDelete] = useState(false);
  const [groupDeletePw, setGroupDeletePw] = useState("");
  const [groupDeletePwError, setGroupDeletePwError] = useState(false);

  const resetPwState = () => {
    setPwMode("view");
    setPw1("");
    setPw2("");
    setPwCheck("");
    setPwCheckError(false);
  };

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
      {editingGroup ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-label">群組名稱</div>
          <input className="input" value={gname} onChange={(e) => setGname(e.target.value)} />
          <div className="section-label" style={{ marginTop: 12 }}>說明</div>
          <textarea className="input textarea" value={gdesc} onChange={(e) => setGdesc(e.target.value)} placeholder="這個群組是做什麼用的" />

          <div className="section-label" style={{ marginTop: 12 }}>密碼保護</div>
          {pwMode === "view" && (
            <>
              <div className="detail-row">
                <span className="detail-label">{group.password ? "已設定密碼" : "尚未設定密碼"}</span>
                <div style={{ display: "flex", gap: 14 }}>
                  <button className="link-btn" onClick={() => setPwMode(group.password ? "change" : "set")}>
                    {group.password ? "更改密碼" : "設定密碼"}
                  </button>
                  {group.password && <button className="link-btn" onClick={() => setPwMode("remove")}>解除</button>}
                </div>
              </div>
              <div className="hint-text">
                這個鎖只是避免手滑點進來，密碼是明文存在雲端的，擋不住真的想看的人。
              </div>
            </>
          )}
          {(pwMode === "set" || pwMode === "change") && (
            <div className="card subtle">
              <div className="section-label">新密碼</div>
              <input className="input mono" type="password" inputMode="numeric" value={pw1} onChange={(e) => setPw1(e.target.value)} />
              <div className="section-label" style={{ marginTop: 8 }}>再次輸入新密碼</div>
              <input className="input mono" type="password" inputMode="numeric" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              {pw1 && pw2 && pw1 !== pw2 && <div className="hint-text hint-warn">兩次輸入不一致</div>}
              <div className="row-form" style={{ marginTop: 8 }}>
                <button className="btn-ghost" onClick={resetPwState}>取消</button>
                <button
                  className="btn-accent"
                  disabled={!pw1 || pw1 !== pw2}
                  onClick={() => {
                    onSetPassword(pw1);
                    resetPwState();
                  }}
                >
                  確定設定
                </button>
              </div>
            </div>
          )}
          {pwMode === "remove" && (
            <div className="card subtle">
              <div className="section-label">請輸入目前密碼以解除保護</div>
              <input
                className="input mono"
                type="password"
                inputMode="numeric"
                value={pwCheck}
                onChange={(e) => {
                  setPwCheck(e.target.value);
                  setPwCheckError(false);
                }}
              />
              {pwCheckError && <div className="hint-text hint-warn">密碼不正確</div>}
              <div className="row-form" style={{ marginTop: 8 }}>
                <button className="btn-ghost" onClick={resetPwState}>取消</button>
                <button
                  className="btn-accent"
                  onClick={() => {
                    if (pwCheck === group.password || pwCheck === MASTER_PASSWORD) {
                      onRemovePassword();
                      resetPwState();
                    } else {
                      setPwCheckError(true);
                    }
                  }}
                >
                  確定解除
                </button>
              </div>
            </div>
          )}

          <div className="row-form" style={{ marginTop: 12 }}>
            <button
              className="btn-ghost"
              onClick={() => {
                setEditingGroup(false);
                setGname(group.name);
                setGdesc(group.description || "");
                resetPwState();
                setConfirmingGroupDelete(false);
              }}
            >
              取消
            </button>
            <button
              className="btn-accent"
              disabled={!gname.trim()}
              onClick={() => {
                onUpdateGroup(gname.trim(), gdesc.trim());
                setEditingGroup(false);
              }}
            >
              儲存
            </button>
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>刪除群組</div>
          {!confirmingGroupDelete ? (
            <button className="btn-outline btn-danger full-width" onClick={() => setConfirmingGroupDelete(true)}>
              刪除群組
            </button>
          ) : (
            <div className="card subtle">
              <div className="hint-text">
                刪除「{group.name}」會一併刪除底下 {projects.length} 個專案與 {expenses.length} 筆項目，且無法復原。請輸入萬能密碼確認。
              </div>
              <input
                className="input mono"
                type="password"
                inputMode="numeric"
                value={groupDeletePw}
                onChange={(e) => {
                  setGroupDeletePw(e.target.value);
                  setGroupDeletePwError(false);
                }}
                placeholder="萬能密碼"
                style={{ marginTop: 8 }}
              />
              {groupDeletePwError && <div className="hint-text hint-warn">密碼不正確</div>}
              <div className="row-form" style={{ marginTop: 8 }}>
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setConfirmingGroupDelete(false);
                    setGroupDeletePw("");
                    setGroupDeletePwError(false);
                  }}
                >
                  取消
                </button>
                <button
                  className="btn-accent"
                  onClick={() => {
                    if (groupDeletePw === MASTER_PASSWORD) onDeleteGroup();
                    else setGroupDeletePwError(true);
                  }}
                >
                  確定刪除群組
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
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
                你是 {me.name} · <button className="link-btn" onClick={onSwitchIdentity}>切換身份</button>
              </div>
            )}
          </div>
          <button className="edit-icon-btn" onClick={() => setEditingGroup(true)}>編輯</button>
        </div>
      )}

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
          <div className="section-label" style={{ marginTop: 12 }}>說明(選填)</div>
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
