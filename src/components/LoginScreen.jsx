import React, { useState } from "react";
import { BACKSTAGE_NAME, MASTER_PASSWORD } from "../constants.js";
import { hashPassword, verifyPassword, hasPassword } from "../lib/auth.js";

/**
 * 開啟 App 的第一關：選身分。
 * 暱稱就是帳號，可以設密碼也可以留空。輸入「後臺管理」＋通用密碼會進入後臺。
 */
export function LoginScreen({ users, onLogin, onCreate, onBackstage }) {
  const [mode, setMode] = useState("pick"); // 'pick' | 'password' | 'create'
  const [picked, setPicked] = useState(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPw1, setNewPw1] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const active = Object.values(users)
    .filter((u) => !u.disabled)
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

  const pick = (u) => {
    setError("");
    setPw("");
    if (hasPassword(u)) {
      setPicked(u);
      setMode("password");
    } else {
      onLogin(u.id);
    }
  };

  const submitPassword = async () => {
    setBusy(true);
    setError("");
    try {
      const ok = (await verifyPassword(pw, picked.passwordHash)) || pw === MASTER_PASSWORD;
      if (ok) onLogin(picked.id);
      else setError("密碼不正確");
    } finally {
      setBusy(false);
    }
  };

  const trimmedNew = newName.trim();
  const isBackstageName = trimmedNew === BACKSTAGE_NAME;
  const nameTaken = Object.values(users).some((u) => u.name === trimmedNew);
  const pwMismatch = !!newPw1 && newPw1 !== newPw2;
  const canCreate = !!trimmedNew && !nameTaken && !isBackstageName && !pwMismatch && !busy;

  const submitCreate = async () => {
    setBusy(true);
    setError("");
    try {
      const passwordHash = newPw1 ? await hashPassword(newPw1) : null;
      onCreate(trimmedNew, passwordHash);
    } finally {
      setBusy(false);
    }
  };

  /* ---------- 輸入密碼 ---------- */
  if (mode === "password" && picked) {
    return (
      <div className="screen">
        <div className="onboard-hero">
          <div className="onboard-eyebrow">需要密碼</div>
          <div className="onboard-title">{picked.name}</div>
          <div className="onboard-desc">這個身分有設密碼，請輸入</div>
        </div>
        <input
          className="input mono"
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && pw && !busy) submitPassword();
          }}
          placeholder="請輸入密碼"
          autoFocus
        />
        {error && <div className="hint-text hint-warn">{error}</div>}
        <div className="row-form" style={{ marginTop: 14 }}>
          <button className="btn-ghost" onClick={() => { setMode("pick"); setPicked(null); setPw(""); setError(""); }}>
            換一個
          </button>
          <button className="btn-accent" disabled={!pw || busy} onClick={submitPassword}>
            {busy ? "確認中…" : "進入"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 建立新身分 ---------- */
  if (mode === "create") {
    return (
      <div className="screen">
        <div className="onboard-hero">
          <div className="onboard-eyebrow">建立身分</div>
          <div className="onboard-title">你叫什麼名字？</div>
          <div className="onboard-desc">這個暱稱就是你的帳號，之後記帳都會顯示它</div>
        </div>
        <div className="section-label">暱稱</div>
        <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：猴子" autoFocus />
        {nameTaken && <div className="hint-text hint-warn">已經有人用這個暱稱了，請換一個</div>}
        {isBackstageName && <div className="hint-text hint-warn">這是保留名稱，不能用來建立帳號</div>}

        <div className="section-label" style={{ marginTop: 12 }}>密碼（可留空）</div>
        <input className="input mono" type="password" value={newPw1} onChange={(e) => setNewPw1(e.target.value)} placeholder="不想設就留空" />
        {newPw1 && (
          <>
            <div className="section-label" style={{ marginTop: 8 }}>再次輸入密碼</div>
            <input className="input mono" type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
            {pwMismatch && <div className="hint-text hint-warn">兩次輸入不一致</div>}
          </>
        )}
        <div className="hint-text">
          不設密碼的話，任何打開這個網站的人都能選你的身分。密碼只擋手滑，不是嚴密的保護。
        </div>

        <div className="row-form" style={{ marginTop: 14 }}>
          <button className="btn-ghost" onClick={() => { setMode("pick"); setNewName(""); setNewPw1(""); setNewPw2(""); }}>
            取消
          </button>
          <button className="btn-accent" disabled={!canCreate} onClick={submitCreate}>
            {busy ? "建立中…" : "建立並進入"}
          </button>
        </div>
      </div>
    );
  }

  /* ---------- 選身分 ---------- */
  return (
    <div className="screen">
      <div className="app-title-block" style={{ display: "block" }}>
        <div className="app-title">分帳本</div>
        <div className="app-sub">朋友之間，帳算清楚，感情才長久</div>
      </div>

      <div className="section-label">你是誰？</div>
      {active.length > 0 ? (
        <div className="member-pick-grid">
          {active.map((u) => (
            <button key={u.id} className="member-pick" onClick={() => pick(u)}>
              {u.name}
              {hasPassword(u) && <span className="lock-mark"> 🔒</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-hint">還沒有任何身分，建立第一個吧</div>
      )}

      <button className="btn-outline full-width" style={{ marginTop: 16 }} onClick={() => setMode("create")}>
        ＋ 建立新身分
      </button>

      <button className="link-btn" style={{ marginTop: 20, alignSelf: "center" }} onClick={onBackstage}>
        後臺管理
      </button>
    </div>
  );
}

/** 後臺管理的入口：只驗通用密碼。 */
export function BackstageLogin({ onEnter, onCancel }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (pw === MASTER_PASSWORD) onEnter();
    else setError(true);
  };

  return (
    <div className="screen">
      <div className="onboard-hero">
        <div className="onboard-eyebrow">後臺管理</div>
        <div className="onboard-title">{BACKSTAGE_NAME}</div>
        <div className="onboard-desc">請輸入通用密碼</div>
      </div>
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
          if (e.key === "Enter") submit();
        }}
        autoFocus
      />
      {error && <div className="hint-text hint-warn">密碼不正確</div>}
      <div className="row-form" style={{ marginTop: 14 }}>
        <button className="btn-ghost" onClick={onCancel}>取消</button>
        <button className="btn-accent" disabled={!pw} onClick={submit}>進入後臺</button>
      </div>
    </div>
  );
}
