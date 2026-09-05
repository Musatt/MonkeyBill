import React, { useState, useMemo } from "react";
import { BACKSTAGE_NAME } from "../constants.js";
import { hashPassword } from "../lib/auth.js";
import { formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances } from "../lib/money.js";
import { TopBar } from "./primitives.jsx";

/**
 * 個人資料。帳號是全域的，所以這一頁不綁群組。
 * 暱稱與密碼只有本人（或後臺）能改；聯絡與收款資料開放給同群組的人填，
 * 因為常常是「我知道他的帳號，幫他補上去」。
 */
export function UserProfilePage({ user, data, viewerId, backstage, visibleGroups, onBack, onUpdate, onSetPassword }) {
  const isSelf = user.id === viewerId;
  const canEditIdentity = isSelf || backstage;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [bankCode, setBankCode] = useState(user.bankCode || "");
  const [bankAccount, setBankAccount] = useState(user.bankAccount || "");
  const [otherPayment, setOtherPayment] = useState(user.otherPayment || "");

  const [pwOpen, setPwOpen] = useState(false);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  const startEdit = () => {
    setName(user.name);
    setPhone(user.phone || "");
    setBankCode(user.bankCode || "");
    setBankAccount(user.bankAccount || "");
    setOtherPayment(user.otherPayment || "");
    setEditing(true);
  };

  const trimmed = name.trim();
  const nameTaken = Object.values(data.users).some((u) => u.id !== user.id && u.name === trimmed);
  const isReserved = trimmed === BACKSTAGE_NAME;
  const nameError = !trimmed ? "請輸入暱稱" : nameTaken ? "已經有人用這個暱稱了" : isReserved ? "這是保留名稱，不能用" : "";

  // 這個人在「我看得到的群組」裡還沒結清的專案
  const projectBalances = useMemo(() => {
    const results = [];
    visibleGroups.forEach((g) => {
      Object.values(data.projects)
        .filter((p) => p.groupId === g.id)
        .forEach((project) => {
          const projectExpenses = Object.values(data.expenses).filter((e) => e.projectId === project.id);
          if (projectExpenses.length === 0) return;
          const ids = [...new Set([...project.memberIds, user.id])];
          const decimals = projectDecimals(project);
          const bal = reconcileBalances(computeBalances(ids, projectExpenses, decimals), decimals)[user.id] || 0;
          if (Math.abs(bal) > 0.005) results.push({ group: g, project, balance: bal, decimals });
        });
    });
    return results;
  }, [data, visibleGroups, user.id]);

  const totalsByCurrency = useMemo(() => {
    const totals = {};
    projectBalances.forEach(({ project, balance, decimals }) => {
      const cur = project.baseCurrency;
      if (!totals[cur]) totals[cur] = { amount: 0, decimals: 0 };
      totals[cur].amount += balance;
      totals[cur].decimals = Math.max(totals[cur].decimals, decimals);
    });
    return totals;
  }, [projectBalances]);

  const savePassword = async () => {
    setBusy(true);
    try {
      onSetPassword(user.id, pw1 ? await hashPassword(pw1) : null);
      setPw1("");
      setPw2("");
      setPwOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <TopBar title={user.name} subtitle={isSelf ? "你的個人資料" : "成員資料"} onBack={onBack} />

      {editing ? (
        <div className="card">
          {canEditIdentity ? (
            <>
              <div className="section-label">暱稱（也是登入用的帳號）</div>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              {nameError && <div className="hint-text hint-warn">{nameError}</div>}
            </>
          ) : (
            <div className="hint-text">暱稱只有本人能改。你可以幫他補聯絡與收款資料。</div>
          )}
          <div className="section-label" style={{ marginTop: 12 }}>聯絡電話</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx-xxx-xxx" inputMode="tel" />
          <div className="row-2">
            <div>
              <div className="section-label" style={{ marginTop: 12 }}>銀行代碼</div>
              <input className="input mono" value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="例如 822" inputMode="numeric" />
            </div>
            <div>
              <div className="section-label" style={{ marginTop: 12 }}>銀行帳號</div>
              <input className="input mono" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="帳號" inputMode="numeric" />
            </div>
          </div>
          <div className="section-label" style={{ marginTop: 12 }}>其他收款方式</div>
          <input className="input" value={otherPayment} onChange={(e) => setOtherPayment(e.target.value)} placeholder="例如 LINE Pay、街口帳號等" />
          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => setEditing(false)}>取消</button>
            <button
              className="btn-accent"
              disabled={canEditIdentity && !!nameError}
              onClick={() => {
                onUpdate(user.id, {
                  ...(canEditIdentity ? { name: trimmed } : {}),
                  phone: phone.trim(),
                  bankCode: bankCode.trim(),
                  bankAccount: bankAccount.trim(),
                  otherPayment: otherPayment.trim(),
                });
                setEditing(false);
              }}
            >
              儲存
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="list-stack">
            <div className="detail-row">
              <span className="detail-label">聯絡電話</span>
              <span className="mono">{user.phone || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">銀行代碼</span>
              <span className="mono">{user.bankCode || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">銀行帳號</span>
              <span className="mono">{user.bankAccount || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">其他收款方式</span>
              <span className="mono">{user.otherPayment || "尚未填寫"}</span>
            </div>
          </div>
          <button className="btn-outline full-width" style={{ marginTop: 16 }} onClick={startEdit}>編輯資料</button>

          {canEditIdentity && (
            <>
              <div className="section-label" style={{ marginTop: 20 }}>登入密碼</div>
              {!pwOpen ? (
                <div className="detail-row">
                  <span className="detail-label">{user.passwordHash ? "已設定密碼" : "沒有設密碼"}</span>
                  <button className="link-btn" onClick={() => setPwOpen(true)}>
                    {user.passwordHash ? "更改或移除" : "設定密碼"}
                  </button>
                </div>
              ) : (
                <div className="card subtle">
                  <div className="section-label">新密碼（留空＝不需要密碼）</div>
                  <input className="input mono" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} autoFocus />
                  {pw1 && (
                    <>
                      <div className="section-label" style={{ marginTop: 8 }}>再次輸入</div>
                      <input className="input mono" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
                      {pw2 && pw1 !== pw2 && <div className="hint-text hint-warn">兩次輸入不一致</div>}
                    </>
                  )}
                  <div className="hint-text">忘記密碼時可以用通用密碼登入，或請管理員從後臺處理。</div>
                  <div className="row-form" style={{ marginTop: 10 }}>
                    <button className="btn-ghost" onClick={() => { setPwOpen(false); setPw1(""); setPw2(""); }}>取消</button>
                    <button className="btn-accent" disabled={busy || (!!pw1 && pw1 !== pw2)} onClick={savePassword}>
                      {busy ? "儲存中…" : pw1 ? "設定密碼" : "移除密碼"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="section-label" style={{ marginTop: 20 }}>未結清的專案</div>
          {projectBalances.length === 0 ? (
            <div className="empty-hint">目前沒有未結清的專案</div>
          ) : (
            <>
              <div className="list-stack" style={{ marginBottom: 12 }}>
                {Object.entries(totalsByCurrency).map(([cur, { amount, decimals }]) => (
                  <div key={cur} className="balance-row">
                    <span>{cur} 合計</span>
                    <span className={"mono" + (amount > 0.005 ? " text-pos" : amount < -0.005 ? " text-neg" : "")}>
                      {formatSigned(amount, cur, decimals)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="hint-text" style={{ marginBottom: 8 }}>正數＝別人該還他，負數＝他該還別人。</div>
              <div className="list-stack">
                {projectBalances.map(({ group, project, balance, decimals }) => (
                  <div key={project.id} className="related-item-row">
                    <div className="related-item-main">
                      <span className="related-item-note">{project.name}</span>
                      <span className={"mono related-item-amount" + (balance > 0 ? " text-pos" : " text-neg")}>
                        {formatSigned(balance, project.baseCurrency, decimals)}
                      </span>
                    </div>
                    <div className="related-item-meta"><span>{group.name}</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
