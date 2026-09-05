import React, { useState } from "react";
import { todayStr } from "../lib/format.js";
import { TopBar, DatePickerBox } from "./primitives.jsx";

/** 編輯專案：獨立畫面。設定群組成員都能改，刪除只有管理者能做。 */
export function ProjectEditScreen({ project, expenseCount, canDelete, onBack, onSave, onDeleteProject }) {
  const [pname, setPname] = useState(project.name);
  const [pdesc, setPdesc] = useState(project.description || "");
  const [pdecimals, setPdecimals] = useState(project.settlementDecimals ?? 0);
  const [pdate, setPdate] = useState(project.date || todayStr());
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");

  const dirty =
    pname.trim() !== project.name ||
    pdesc.trim() !== (project.description || "") ||
    pdecimals !== (project.settlementDecimals ?? 0) ||
    pdate !== (project.date || "");

  return (
    <div className="screen">
      <TopBar title="編輯專案" subtitle={project.name} onBack={onBack} />

      <div className="section-label">專案名稱</div>
      <input className="input" value={pname} onChange={(e) => setPname(e.target.value)} />

      <div className="section-label" style={{ marginTop: 12 }}>說明（選填）</div>
      <textarea className="input textarea" value={pdesc} onChange={(e) => setPdesc(e.target.value)} placeholder="這個專案是做什麼用的" />

      <div className="section-label" style={{ marginTop: 12 }}>專案日期</div>
      <DatePickerBox value={pdate} onChange={setPdate} />

      <div className="section-label" style={{ marginTop: 12 }}>金額顯示與結算位數</div>
      <div className="mode-switch mode-switch-3">
        <button className={pdecimals === 0 ? "on" : ""} onClick={() => setPdecimals(0)}>整數</button>
        <button className={pdecimals === 1 ? "on" : ""} onClick={() => setPdecimals(1)}>小數1位</button>
        <button className={pdecimals === 2 ? "on" : ""} onClick={() => setPdecimals(2)}>小數2位</button>
      </div>
      <div className="hint-text">這個專案裡所有 {project.baseCurrency} 金額都會用這個位數顯示與結算。</div>

      <div className="section-label" style={{ marginTop: 24 }}>刪除專案</div>
      {!canDelete ? (
        <div className="hint-text">只有群組管理者可以刪除專案。</div>
      ) : !confirming ? (
        <button className="btn-outline btn-danger full-width" onClick={() => setConfirming(true)}>
          刪除專案
        </button>
      ) : (
        <div className="card subtle">
          <div className="hint-text hint-warn">
            刪除「{project.name}」會一併刪除底下 {expenseCount} 筆項目，且無法復原。
          </div>
          <div className="hint-text" style={{ marginTop: 8 }}>
            確定的話，請輸入專案名稱「{project.name}」：
          </div>
          <input
            className="input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={project.name}
            style={{ marginTop: 6 }}
          />
          <div className="row-form" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={() => { setConfirming(false); setTyped(""); }}>取消</button>
            <button className="btn-accent" disabled={typed.trim() !== project.name} onClick={onDeleteProject}>
              確定刪除專案
            </button>
          </div>
        </div>
      )}

      <div className="form-actions">
        <div className="row-form">
          <button className="btn-ghost" onClick={onBack}>取消</button>
          <button
            className="btn-accent"
            disabled={!pname.trim() || !dirty}
            onClick={() => onSave(pname.trim(), pdesc.trim(), pdecimals, pdate)}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
