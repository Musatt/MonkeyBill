import React, { useState } from "react";
import { MASTER_PASSWORD } from "../constants.js";

export function GroupLockScreen({ group, onUnlock, onBack }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const tryUnlock = () => {
    if (pw === group.password || pw === MASTER_PASSWORD) onUnlock();
    else setError(true);
  };

  return (
    <div className="screen">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <button className="backbtn" onClick={onBack} aria-label="返回">‹</button>
      </div>
      <div className="onboard-hero">
        <div className="onboard-eyebrow">已鎖定</div>
        <div className="onboard-title">{group.name}</div>
        <div className="onboard-desc">這個群組設有密碼保護，請輸入密碼</div>
      </div>
      <div className="section-label">密碼</div>
      <input
        className="input mono"
        type="password"
        inputMode="numeric"
        value={pw}
        onChange={(e) => {
          setPw(e.target.value);
          setError(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") tryUnlock();
        }}
        placeholder="請輸入密碼"
        autoFocus
      />
      {error && <div className="hint-text hint-warn">密碼不正確</div>}
      <button className="btn-accent full-width" style={{ marginTop: 14 }} disabled={!pw} onClick={tryUnlock}>
        解鎖
      </button>
      <div className="hint-text" style={{ marginTop: 10 }}>
        解鎖後這台裝置會記住，下次不用再輸入。
      </div>
    </div>
  );
}
