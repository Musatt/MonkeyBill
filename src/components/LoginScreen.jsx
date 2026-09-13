import React, { useState, useMemo } from "react";
import { BACKSTAGE_NAME, MASTER_PASSWORD } from "../constants.js";
import { hashPassword, verifyPassword, hasPassword } from "../lib/auth.js";
import { canLogin } from "../lib/permissions.js";
import { PinInput } from "./primitives.jsx";
import { normalizeName, nameError } from "../lib/names.js";
import { sortByCreation, searchUsers } from "../lib/loginList.js";

/**
 * 開啟 App 的第一關：選身分。
 * 暱稱就是帳號，可以設密碼也可以留空。輸入「後臺管理」＋通用密碼會進入後臺。
 */
export function LoginScreen({ users, groups, onLogin, onCreate, onBackstage }) {
  const [mode, setMode] = useState("pick"); // 'pick' | 'password' | 'create'
  const [picked, setPicked] = useState(null);
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newPw1, setNewPw1] = useState("");
  const [newPw2, setNewPw2] = useState("");

  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  // 虛擬成員在這裡整個不出現——這就是它存在的理由：
  // 沒設密碼的身分等於一扇沒鎖的門，虛擬成員連門都不掛出來。
  // 不依群組分區：分區會把群組名稱秀給每個打開網站的人看。
  const active = useMemo(
    () => sortByCreation(Object.values(users).filter(canLogin), groups),
    [users, groups]
  );
  const matches = useMemo(() => searchUsers(active, query), [active, query]);
  const searching = !!normalizeName(query);

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

  const trimmedNew = normalizeName(newName);
  const newNameError = newName ? nameError(newName, users) : "";
  const pwMismatch = !!newPw1 && newPw1 !== newPw2;
  const canCreate = !!trimmedNew && !newNameError && !pwMismatch && !busy;

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
        <PinInput
          allowKeyboardSwitch
          autoComplete="current-password"
          value={pw}
          onChange={(v) => {
            setPw(v);
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
        {newNameError && <div className="hint-text hint-warn">{newNameError}</div>}

        <div className="section-label" style={{ marginTop: 12 }}>密碼（數字，可留空）</div>
        <PinInput digitsOnly autoComplete="new-password" value={newPw1} onChange={setNewPw1} placeholder="不想設就留空" />
        {newPw1 && (
          <>
            <div className="section-label" style={{ marginTop: 8 }}>再次輸入密碼</div>
            <PinInput digitsOnly autoComplete="new-password" value={newPw2} onChange={setNewPw2} />
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
      {/* 建立身分與後臺放在最上面：人多的時候名單很長，放底下會被擠到很難找 */}
      <div className="hdr">
        <div className="hdr-text">
          <div className="hdr-name" style={{ fontSize: 24 }}>分帳本</div>
          <div className="hdr-sub">朋友之間，帳算清楚，感情才長久</div>
        </div>
        <button className="login-create" onClick={() => setMode("create")}>＋ 建立身分</button>
        <div className="menu-wrap">
          <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="更多" aria-expanded={menuOpen}>
            ⋯
          </button>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="menu-pop" role="menu">
                <button onClick={() => { setMenuOpen(false); onBackstage(); }}>後臺管理</button>
              </div>
            </>
          )}
        </div>
      </div>

      {active.length === 0 ? (
        <div className="empty-hint" style={{ marginTop: 12 }}>還沒有任何身分，按右上角「建立身分」建立第一個</div>
      ) : (
        <>
          {/* 搜尋框黏在畫面上方，名單滑到很下面也還打得到字 */}
          <div className="login-search">
            <input
              className="input"
              type="search"
              enterKeyHint="go"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // 只剩一個人時直接按 Enter 就是選他
                if (e.key === "Enter" && matches.length === 1) pick(matches[0]);
              }}
              placeholder="搜尋名字"
              aria-label="搜尋名字"
            />
            {query && (
              <button className="login-search-clear" onClick={() => setQuery("")} aria-label="清除搜尋">
                ×
              </button>
            )}
          </div>

          <div className="sec-head sec-head-tight">
            {searching ? "找到" : "你是誰？"} <span className="sec-head-n">{matches.length}</span> 人
          </div>

          {matches.length > 0 ? (
            <div className="member-pick-grid">
              {matches.map((u) => (
                <button key={u.id} className="member-pick" onClick={() => pick(u)}>
                  {u.name}
                  {hasPassword(u) && <span className="lock-mark"> 🔒</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-hint">
              找不到「{normalizeName(query)}」
              {/* 名字可以用才提供快捷建立；被別人（含看不到的虛擬成員）用掉就不提，免得透露有這個人 */}
              {!nameError(query, users) && (
                <div style={{ marginTop: 10 }}>
                  <button
                    className="btn-outline"
                    onClick={() => {
                      setNewName(normalizeName(query));
                      setMode("create");
                    }}
                  >
                    用「{normalizeName(query)}」建立新身分
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
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
      <PinInput
        digitsOnly
        autoComplete="off"
        value={pw}
        onChange={(v) => {
          setPw(v);
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
