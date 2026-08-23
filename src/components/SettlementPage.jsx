import React, { useState, useMemo } from "react";
import { formatMoney, formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances, simplifyDebts, oneCollectorSettlement } from "../lib/money.js";

export function SettlementPage({ project, expenses, membersById, myId, onModeChange, onMarkPaid }) {
  const decimals = projectDecimals(project);
  const balances = useMemo(() => computeBalances(project.memberIds, expenses), [project.memberIds, expenses]);
  const reconciled = useMemo(() => reconcileBalances(balances, decimals), [balances, decimals]);
  const [payModalTxn, setPayModalTxn] = useState(null);

  const txns = useMemo(() => {
    if (project.settlementMode === "one" && project.collectorId) {
      return oneCollectorSettlement(reconciled, project.collectorId, decimals);
    }
    return simplifyDebts(reconciled, decimals);
  }, [reconciled, project.settlementMode, project.collectorId, decimals]);

  // 已被移出專案、但歷史紀錄裡還有餘額的人也要列出來
  const rowIds = [...new Set([...project.memberIds, ...Object.keys(reconciled)])];
  const payee = payModalTxn ? membersById[payModalTxn.to] : null;

  return (
    <div className="screen">
      <div className="mode-switch">
        <button className={project.settlementMode !== "one" ? "on" : ""} onClick={() => onModeChange("min", project.collectorId)}>
          最少轉帳次數
        </button>
        <button
          className={project.settlementMode === "one" ? "on" : ""}
          onClick={() => onModeChange("one", project.collectorId || project.memberIds[0])}
        >
          指定一人全收發
        </button>
      </div>

      {project.settlementMode === "one" && (
        <>
          <div className="section-label">收發款人</div>
          <select className="input" value={project.collectorId || ""} onChange={(e) => onModeChange("one", e.target.value)}>
            {project.memberIds.map((id) => (
              <option key={id} value={id}>{membersById[id]?.name || "?"}</option>
            ))}
          </select>
          <div className="hint-text">所有人先跟他結清，再由他付給該收錢的人。</div>
        </>
      )}

      <div className="section-label" style={{ marginTop: 16 }}>目前餘額</div>
      <div className="balance-list">
        {rowIds.map((id) => {
          const v = reconciled[id] || 0;
          const positive = v > 0.005;
          const negative = v < -0.005;
          const inProject = project.memberIds.includes(id);
          const isMe = id === myId;
          return (
            <div
              key={id}
              className={"balance-row" + (inProject ? "" : " balance-row-deleted") + (isMe ? " balance-row-me" : "")}
            >
              <span>
                {membersById[id]?.name || "?"}
                {isMe && <span className="row-me-tag">你</span>}
                {!inProject && <span className="hint-text" style={{ marginLeft: 6 }}>（已不在專案）</span>}
              </span>
              <span className={"mono" + (positive ? " text-pos" : negative ? " text-neg" : "")}>
                {formatSigned(v, project.baseCurrency, decimals)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="hint-text">正數＝別人該還他，負數＝他該還別人。</div>

      <div className="section-label" style={{ marginTop: 16 }}>建議轉帳</div>
      <div className="txn-list">
        {txns.map((t, i) => {
          const involvesMe = t.from === myId || t.to === myId;
          return (
            <div key={`${t.from}-${t.to}-${i}`} className={"txn-row" + (involvesMe ? " txn-row-me" : "")}>
              <span className={t.from === myId ? "name-me" : undefined}>
                {membersById[t.from]?.name || "?"}
                {t.from === myId && <span className="row-me-tag">你</span>}
              </span>
              <span className="txn-arrow">→</span>
              <span className={t.to === myId ? "name-me" : undefined}>
                {membersById[t.to]?.name || "?"}
                {t.to === myId && <span className="row-me-tag">你</span>}
              </span>
              <span className="mono txn-amount">{formatMoney(t.amount, project.baseCurrency, decimals)}</span>
              <button className="pay-btn" onClick={() => setPayModalTxn(t)}>付款</button>
            </div>
          );
        })}
        {txns.length === 0 && <div className="empty-hint">帳目已結清 🎉</div>}
      </div>
      <div className="hint-text" style={{ marginTop: 10 }}>
        每人金額無條件進位至{decimals === 0 ? "整數" : `小數 ${decimals} 位`}，最大收款人吸收尾差，確保總和為 0。
      </div>

      {payModalTxn && (
        <div className="modal-backdrop" onClick={() => setPayModalTxn(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">付款給</div>
            <div className="modal-title">{payee?.name || "?"}</div>
            <div className="modal-amount mono">{formatMoney(payModalTxn.amount, project.baseCurrency, decimals)}</div>
            <div className="detail-row">
              <span className="detail-label">連絡電話</span>
              <span className="mono">{payee?.phone || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">銀行代碼</span>
              <span className="mono">{payee?.bankCode || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">銀行帳號</span>
              <span className="mono">{payee?.bankAccount || "尚未填寫"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">其他收款方式</span>
              <span className="mono">{payee?.otherPayment || "尚未填寫"}</span>
            </div>
            <div className="hint-text">按「已付款」會幫你建一筆轉帳項目，餘額才會跟著更新。</div>
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setPayModalTxn(null)}>關閉</button>
              <button
                className="btn-accent"
                onClick={() => {
                  onMarkPaid(payModalTxn);
                  setPayModalTxn(null);
                }}
              >
                已付款
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
