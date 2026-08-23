import React, { useState } from "react";
import { MASTER_PASSWORD } from "../constants.js";
import { todayStr } from "../lib/format.js";
import { TopBar, DatePickerBox } from "./primitives.jsx";

/** 編輯專案：獨立畫面，不會把專案分頁的內容往下擠。 */
export function ProjectEditScreen({ group, project, expenseCount, onBack, onSave, onDeleteProject }) {
  const [pname, setPname] = useState(project.name);
  const [pdesc, setPdesc] = useState(project.description || "");
  const [pdecimals, setPdecimals] = useState(project.settlementDecimals ?? 0);
  const [pdate, setPdate] = useState(project.date || todayStr());
  const [deleteStage, setDeleteStage] = useState(null); // null | 'password' | 'confirm'
  const [deletePw, setDeletePw] = useState("");
  const [deletePwError, setDeletePwError] = useState(false);

  const resetDeleteStage = () => {
    setDeleteStage(null);
    setDeletePw("");
    setDeletePwError(false);
  };

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
      {deleteStage === null && (
        <button
          className="btn-outline btn-danger full-width"
          onClick={() => setDeleteStage(group.password ? "password" : "confirm")}
        >
          刪除專案
        </button>
      )}
      {deleteStage === "password" && (
        <div className="card subtle">
          <div className="section-label">請輸入群組密碼以繼續刪除</div>
          <input
            className="input mono"
            type="password"
            inputMode="numeric"
            value={deletePw}
            onChange={(e) => {
              setDeletePw(e.target.value);
              setDeletePwError(false);
            }}
            autoFocus
          />
          {deletePwError && <div className="hint-text hint-warn">密碼不正確</div>}
          <div className="row-form" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={resetDeleteStage}>取消</button>
            <button
              className="btn-accent"
              onClick={() => {
                if (deletePw === group.password || deletePw === MASTER_PASSWORD) {
                  setDeleteStage("confirm");
                  setDeletePw("");
                  setDeletePwError(false);
                } else {
                  setDeletePwError(true);
                }
              }}
            >
              下一步
            </button>
          </div>
        </div>
      )}
      {deleteStage === "confirm" && (
        <div className="card subtle">
          <div className="hint-text">
            確定要刪除「{project.name}」嗎？裡面 {expenseCount} 筆項目都會一併刪除，且無法復原。
          </div>
          <div className="row-form" style={{ marginTop: 8 }}>
            <button className="btn-ghost" onClick={resetDeleteStage}>取消</button>
            <button className="btn-accent" onClick={onDeleteProject}>確定刪除專案</button>
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
