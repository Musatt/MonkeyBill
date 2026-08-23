import React, { useState } from "react";
import { BackupPanel } from "./BackupPanel.jsx";

export function Home({ groups, onOpenGroup, onCreateGroup, data, onRestore, onRefresh }) {
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [memberText, setMemberText] = useState("");
  const [syncing, setSyncing] = useState(false);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const parsedNames = memberText.split(/[,，\n]/).map((s) => s.trim()).filter(Boolean);
  const dupNames = parsedNames.filter((n, i) => parsedNames.indexOf(n) !== i);

  return (
    <div className="screen">
      <div className="app-title-block">
        <div>
          <div className="app-title">分帳本</div>
          <div className="app-sub">朋友之間，帳算清楚，感情才長久</div>
        </div>
        <button className="edit-icon-btn" onClick={handleRefresh} disabled={syncing}>
          {syncing ? "同步中…" : "🔄 同步"}
        </button>
      </div>
      <div className="section-label">我的群組</div>
      <div className="list-stack">
        {groups.map((g) => {
          const activeCount = g.members.filter((m) => !m.deleted).length;
          return (
            <button key={g.id} className="group-card" onClick={() => onOpenGroup(g.id)}>
              <div className="group-card-name">
                {g.name}
                {g.password && " 🔒"}
              </div>
              {g.description && <div className="card-desc">{g.description}</div>}
              <div className="group-card-meta">{activeCount} 位成員</div>
            </button>
          );
        })}
        {groups.length === 0 && <div className="empty-hint">還沒有群組，建立第一個吧</div>}
      </div>

      {!showNew ? (
        <button className="btn-outline full-width" style={{ marginTop: 16 }} onClick={() => setShowNew(true)}>
          ＋ 新增群組
        </button>
      ) : (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-label">群組名稱</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：勿考試喝酒" autoFocus />
          <div className="section-label" style={{ marginTop: 12 }}>說明(選填)</div>
          <textarea className="input textarea" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="這個群組是做什麼用的" />
          <div className="section-label" style={{ marginTop: 12 }}>成員(用逗號分開)</div>
          <textarea
            className="input textarea"
            value={memberText}
            onChange={(e) => setMemberText(e.target.value)}
            placeholder="猴子, 昭毅, 小比..."
          />
          {parsedNames.length > 0 && (
            <div className={"hint-text" + (dupNames.length ? " hint-warn" : "")}>
              {dupNames.length
                ? `有重複的名字：${[...new Set(dupNames)].join("、")}`
                : `將建立 ${parsedNames.length} 位成員：${parsedNames.join("、")}`}
            </div>
          )}
          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setShowNew(false)}>取消</button>
            <button
              className="btn-accent"
              disabled={!name.trim() || dupNames.length > 0}
              onClick={() => {
                onCreateGroup(name.trim(), desc.trim(), parsedNames);
                setShowNew(false);
                setName("");
                setDesc("");
                setMemberText("");
              }}
            >
              建立群組
            </button>
          </div>
        </div>
      )}

      <BackupPanel data={data} onRestore={onRestore} />
    </div>
  );
}
