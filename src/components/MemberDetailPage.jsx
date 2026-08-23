import React, { useState, useMemo } from "react";
import { findMemberByName, formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances } from "../lib/money.js";
import { TopBar } from "./primitives.jsx";

export function MemberDetailPage({ member, groupName, groupMembers, projects, expenses, isMe, onBack, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone || "");
  const [bankCode, setBankCode] = useState(member.bankCode || "");
  const [bankAccount, setBankAccount] = useState(member.bankAccount || "");
  const [otherPayment, setOtherPayment] = useState(member.otherPayment || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const startEdit = () => {
    setName(member.name);
    setPhone(member.phone || "");
    setBankCode(member.bankCode || "");
    setBankAccount(member.bankAccount || "");
    setOtherPayment(member.otherPayment || "");
    setEditing(true);
  };

  const duplicate = name.trim() ? findMemberByName(groupMembers, name, member.id) : null;

  const projectBalances = useMemo(() => {
    const results = [];
    projects.forEach((project) => {
      const projectExpenses = expenses.filter((e) => e.projectId === project.id);
      if (projectExpenses.length === 0) return;
      // 已被移出專案、但歷史紀錄裡還有他的人也要算進來
      const memberIdsForCalc = [...new Set([...project.memberIds, member.id])];
      const decimals = projectDecimals(project);
      const reconciled = reconcileBalances(computeBalances(memberIdsForCalc, projectExpenses), decimals);
      const bal = reconciled[member.id] || 0;
      if (Math.abs(bal) > 0.005) results.push({ project, balance: bal, decimals });
    });
    return results;
  }, [projects, expenses, member.id]);

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

  return (
    <div className="screen">
      <TopBar title={member.name} subtitle={groupName} onBack={onBack} />
      {editing ? (
        <div className="card">
          <div className="section-label">姓名</div>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          {duplicate && (
            <div className="hint-text hint-warn">
              {duplicate.deleted ? `「${name.trim()}」是已刪除成員的名字，改成別的名字避免歷史紀錄混淆。` : "已經有相同名字的成員了"}
            </div>
          )}
          <div className="section-label" style={{ marginTop: 12 }}>連絡電話</div>
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
              disabled={!name.trim() || !!duplicate}
              onClick={() => {
                onUpdate({
                  name: name.trim(),
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
              <span className="detail-label">連絡電話</span>
              <span className="mono">{member.phone || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">銀行代碼</span>
              <span className="mono">{member.bankCode || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">銀行帳號</span>
              <span className="mono">{member.bankAccount || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">其他收款方式</span>
              <span className="mono">{member.otherPayment || "尚未填寫"}</span>
            </div>
          </div>
          <button className="btn-outline full-width" style={{ marginTop: 16 }} onClick={startEdit}>編輯資料</button>

          <div className="section-label" style={{ marginTop: 20 }}>所有專案合計淨額</div>
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
              <div className="hint-text" style={{ marginBottom: 8 }}>正數是別人該還他，負數是他該還別人。</div>
              <div className="section-label">未結清專案明細</div>
              <div className="list-stack" style={{ marginBottom: 16 }}>
                {projectBalances.map(({ project, balance, decimals }) => (
                  <div key={project.id} className="related-item-row">
                    <div className="related-item-main">
                      <span className="related-item-note">{project.name}</span>
                      <span className={"mono related-item-amount" + (balance > 0 ? " text-pos" : " text-neg")}>
                        {formatSigned(balance, project.baseCurrency, decimals)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {confirmingDelete ? (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="hint-text">
                刪除後，{member.name} 不會再出現在新增項目、選擇成員的名單裡，但過去所有跟他有關的項目、結算紀錄都會保留，不會被刪除。之後在「新增成員」輸入同樣的名字就可以把他復原。
              </div>
              {projectBalances.length > 0 && (
                <div className="hint-text hint-warn" style={{ marginTop: 8 }}>
                  注意：他目前還有 {projectBalances.length} 個專案沒有結清。
                </div>
              )}
              {isMe && <div className="hint-text hint-warn" style={{ marginTop: 8 }}>這是你目前選擇的身份，刪除後需要重新選一次你是誰。</div>}
              <div className="row-form" style={{ marginTop: 12 }}>
                <button className="btn-ghost" onClick={() => setConfirmingDelete(false)}>取消</button>
                <button className="btn-accent" onClick={onDelete}>確定刪除成員</button>
              </div>
            </div>
          ) : (
            <button className="btn-outline btn-danger full-width" style={{ marginTop: 10 }} onClick={() => setConfirmingDelete(true)}>
              刪除成員
            </button>
          )}
        </>
      )}
    </div>
  );
}
