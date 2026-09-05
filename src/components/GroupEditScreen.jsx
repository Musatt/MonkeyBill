import React, { useState } from "react";
import { TopBar } from "./primitives.jsx";

/** 編輯群組：名稱、說明、刪除。成員管理在另一個畫面。 */
export function GroupEditScreen({ group, projectCount, expenseCount, canDelete, onBack, onSave, onDeleteGroup }) {
  const [gname, setGname] = useState(group.name);
  const [gdesc, setGdesc] = useState(group.description || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [typed, setTyped] = useState("");

  const dirty = gname.trim() !== group.name || gdesc.trim() !== (group.description || "");

  return (
    <div className="screen">
      <TopBar title="編輯群組" subtitle={group.name} onBack={onBack} />

      <div className="section-label">群組名稱</div>
      <input className="input" value={gname} onChange={(e) => setGname(e.target.value)} />

      <div className="section-label" style={{ marginTop: 12 }}>說明（選填）</div>
      <textarea className="input textarea" value={gdesc} onChange={(e) => setGdesc(e.target.value)} placeholder="這個群組是做什麼用的" />

      <div className="section-label" style={{ marginTop: 24 }}>刪除群組</div>
      {!canDelete ? (
        <div className="hint-text">只有群組管理者可以刪除群組。</div>
      ) : !confirmingDelete ? (
        <button className="btn-outline btn-danger full-width" onClick={() => setConfirmingDelete(true)}>
          刪除群組
        </button>
      ) : (
        <div className="card subtle">
          <div className="hint-text hint-warn">
            刪除「{group.name}」會一併刪除底下 {projectCount} 個專案與 {expenseCount} 筆項目，且無法復原。
          </div>
          <div className="hint-text" style={{ marginTop: 8 }}>
            確定的話，請輸入群組名稱「{group.name}」：
          </div>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={group.name} style={{ marginTop: 6 }} />
          <div className="row-form" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => { setConfirmingDelete(false); setTyped(""); }}>取消</button>
            <button className="btn-accent" disabled={typed.trim() !== group.name} onClick={onDeleteGroup}>
              確定刪除群組
            </button>
          </div>
        </div>
      )}

      <div className="form-actions">
        <div className="row-form">
          <button className="btn-ghost" onClick={onBack}>取消</button>
          <button className="btn-accent" disabled={!gname.trim() || !dirty} onClick={() => onSave(gname.trim(), gdesc.trim())}>
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
