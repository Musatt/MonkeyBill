import React, { useState, useMemo } from "react";
import { BackupPanel } from "./BackupPanel.jsx";

/**
 * 首頁：只顯示自己有份的群組。
 * 建立群組時就可以從現有帳號挑成員。
 */
export function Home({ me, groups, users, onOpenGroup, onCreateGroup, onLogout, onOpenProfile, data, onRestore, onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  const [syncing, setSyncing] = useState(false);

  const candidates = useMemo(
    () =>
      Object.values(users)
        .filter((u) => !u.disabled && u.id !== me.id)
        .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
    [users, me.id]
  );

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const create = () => {
    // 建立者一定是成員，而且預設就是管理者
    onCreateGroup(name.trim(), desc.trim(), [me.id, ...picked]);
    setShowNew(false);
    setName("");
    setDesc("");
    setPicked(new Set());
  };

  return (
    <div className="screen">
      <div className="app-title-block">
        <div>
          <div className="app-title">分帳本</div>
          <div className="app-sub">
            你是 {me.name} · <button className="link-btn" onClick={onOpenProfile}>個人資料</button> ·{" "}
            <button className="link-btn" onClick={onLogout}>登出</button>
          </div>
        </div>
        <button className="edit-icon-btn" onClick={handleRefresh} disabled={syncing}>
          {syncing ? "同步中…" : "🔄 同步"}
        </button>
      </div>

      <div className="section-label">我的群組</div>
      <div className="list-stack">
        {groups.map((g) => {
          const activeCount = g.memberIds.filter((id) => !(g.inactiveMemberIds || []).includes(id)).length;
          const isAdmin = (g.adminIds || []).includes(me.id);
          return (
            <button key={g.id} className="group-card" onClick={() => onOpenGroup(g.id)}>
              <div className="group-card-name">
                {g.name}
                {isAdmin && <span className="admin-tag">管理者</span>}
              </div>
              {g.description && <div className="card-desc">{g.description}</div>}
              <div className="group-card-meta">{activeCount} 位成員</div>
            </button>
          );
        })}
        {groups.length === 0 && (
          <div className="empty-hint">你還不在任何群組裡。建立一個，或請朋友把你加進他的群組。</div>
        )}
      </div>

      {!showNew ? (
        <button className="btn-outline full-width" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}>
          ＋ 新增群組
        </button>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-label">群組名稱</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：勿考試喝酒" autoFocus />

          <div className="section-label" style={{ marginTop: 12 }}>說明（選填）</div>
          <textarea className="input textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="這個群組是做什麼用的" />

          <div className="section-label" style={{ marginTop: 12 }}>成員（{picked.size + 1}）</div>
          <div className="hint-text">你自己一定會加入，並且是這個群組的管理者。</div>
          {candidates.length > 0 ? (
            <div className="member-chip-row" style={{ marginTop: 8 }}>
              {candidates.map((u) => (
                <button
                  key={u.id}
                  className={"member-tag selectable" + (picked.has(u.id) ? " member-tag-on" : "")}
                  onClick={() => toggle(u.id)}
                >
                  {u.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="hint-text">目前沒有其他帳號可選，建立群組後可以在「管理成員」裡新增。</div>
          )}

          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setShowNew(false)}>取消</button>
            <button className="btn-accent" disabled={!name.trim()} onClick={create}>建立群組</button>
          </div>
        </div>
      )}

      <BackupPanel data={data} onRestore={onRestore} />
    </div>
  );
}
