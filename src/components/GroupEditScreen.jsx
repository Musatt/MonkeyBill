import React, { useState } from "react";
import { MASTER_PASSWORD } from "../constants.js";
import { TopBar } from "./primitives.jsx";

/** 編輯群組：獨立畫面，不會把群組頁的內容往下擠。 */
export function GroupEditScreen({ group, projectCount, expenseCount, onBack, onSave, onSetPassword, onRemovePassword, onDeleteGroup }) {
  const [gname, setGname] = useState(group.name);
  const [gdesc, setGdesc] = useState(group.description || "");
  const [pwMode, setPwMode] = useState("view"); // 'view' | 'set' | 'change' | 'remove'
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwCheck, setPwCheck] = useState("");
  const [pwCheckError, setPwCheckError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deletePwError, setDeletePwError] = useState(false);

  const resetPwState = () => {
    setPwMode("view");
    setPw1("");
    setPw2("");
    setPwCheck("");
    setPwCheckError(false);
  };

  const dirty = gname.trim() !== group.name || gdesc.trim() !== (group.description || "");

  return (
    <div className="screen">
      <TopBar title="編輯群組" subtitle={group.name} onBack={onBack} />

      <div className="section-label">群組名稱</div>
      <input className="input" value={gname} onChange={(e) => setGname(e.target.value)} />

      <div className="section-label" style={{ marginTop: 12 }}>說明（選填）</div>
      <textarea className="input textarea" value={gdesc} onChange={(e) => setGdesc(e.target.value)} placeholder="這個群組是做什麼用的" />

      <div className="section-label" style={{ marginTop: 20 }}>密碼保護</div>
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
          <div className="hint-text">這個鎖只是避免手滑點進來，密碼是明文存在雲端的，擋不住真的想看的人。</div>
        </>
      )}
      {(pwMode === "set" || pwMode === "change") && (
        <div className="card subtle">
          <div className="section-label">新密碼</div>
          <input className="input mono" type="password" inputMode="numeric" value={pw1} onChange={(e) => setPw1(e.target.value)} autoFocus />
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
            autoFocus
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

      <div className="section-label" style={{ marginTop: 24 }}>刪除群組</div>
      {!confirmingDelete ? (
        <button className="btn-outline btn-danger full-width" onClick={() => setConfirmingDelete(true)}>
          刪除群組
        </button>
      ) : (
        <div className="card subtle">
          <div className="hint-text">
            刪除「{group.name}」會一併刪除底下 {projectCount} 個專案與 {expenseCount} 筆項目，且無法復原。請輸入萬能密碼確認。
          </div>
          <input
            className="input mono"
            type="password"
            inputMode="numeric"
            value={deletePw}
            onChange={(e) => {
              setDeletePw(e.target.value);
              setDeletePwError(false);
            }}
            placeholder="萬能密碼"
            style={{ marginTop: 8 }}
          />
          {deletePwError && <div className="hint-text hint-warn">密碼不正確</div>}
          <div className="row-form" style={{ marginTop: 8 }}>
            <button
              className="btn-ghost"
              onClick={() => {
                setConfirmingDelete(false);
                setDeletePw("");
                setDeletePwError(false);
              }}
            >
              取消
            </button>
            <button
              className="btn-accent"
              onClick={() => {
                if (deletePw === MASTER_PASSWORD) onDeleteGroup();
                else setDeletePwError(true);
              }}
            >
              確定刪除群組
            </button>
          </div>
        </div>
      )}

      <div className="form-actions">
        <div className="row-form">
          <button className="btn-ghost" onClick={onBack}>取消</button>
          <button
            className="btn-accent"
            disabled={!gname.trim() || !dirty}
            onClick={() => onSave(gname.trim(), gdesc.trim())}
          >
            儲存
          </button>
        </div>
      </div>
    </div>
  );
}
