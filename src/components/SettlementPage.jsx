import React, { useState, useMemo } from "react";
import { formatMoney, formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances, simplifyDebts, oneCollectorSettlement, biggestPrepayer } from "../lib/money.js";

/** 一列建議轉帳：誰 → 誰 多少，右邊是付款鍵 */
function TxnRow({ txn, membersById, currency, decimals, myId, onPay }) {
  const iPay = txn.from === myId;
  const iGet = txn.to === myId;
  return (
    <div className={"txn" + (iPay || iGet ? " txn-mine" : "")}>
      <div className="txn-flow">
        <span className={"txn-name" + (iPay ? " txn-name-me" : "")}>
          {membersById[txn.from]?.name || "?"}
          {iPay && <span className="row-me-tag">你</span>}
        </span>
        <span className="txn-arrow" aria-hidden="true">→</span>
        <span className={"txn-name" + (iGet ? " txn-name-me" : "")}>
          {membersById[txn.to]?.name || "?"}
          {iGet && <span className="row-me-tag">你</span>}
        </span>
      </div>
      <span className="txn-amt mono">{formatMoney(txn.amount, currency, decimals)}</span>
      <button className="pay-btn" onClick={() => onPay(txn)}>
        {iPay ? "付款" : iGet ? "已收到" : "記錄"}
      </button>
    </div>
  );
}

export function SettlementPage({ project, expenses, membersById, myId, onModeChange, onMarkPaid }) {
  const decimals = projectDecimals(project);
  const balances = useMemo(() => computeBalances(project.memberIds, expenses, decimals), [project.memberIds, expenses, decimals]);
  const reconciled = useMemo(() => reconcileBalances(balances, decimals), [balances, decimals]);
  const [payModalTxn, setPayModalTxn] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // 沒指定收發款人就自動用代墊最多的人，不要因為沒設定就退回「最少轉帳次數」
  const autoCollectorId = useMemo(
    () => biggestPrepayer(project.memberIds, expenses),
    [project.memberIds, expenses]
  );
  const oneMode = project.settlementMode === "one";
  const collectorId = project.collectorId || autoCollectorId;

  const txns = useMemo(() => {
    if (oneMode && collectorId) {
      return oneCollectorSettlement(reconciled, collectorId, decimals);
    }
    return simplifyDebts(reconciled, decimals);
  }, [reconciled, oneMode, collectorId, decimals]);

  // 先照收款人分組（收得多的在前），組內再依金額大→小
  const sortedTxns = useMemo(() => {
    const totalPerPayee = {};
    txns.forEach((t) => (totalPerPayee[t.to] = (totalPerPayee[t.to] || 0) + t.amount));
    return [...txns].sort((a, b) => {
      if (a.to !== b.to) {
        const diff = totalPerPayee[b.to] - totalPerPayee[a.to];
        if (Math.abs(diff) > 1e-9) return diff;
        return String(a.to).localeCompare(String(b.to));
      }
      return b.amount - a.amount;
    });
  }, [txns]);

  const myTxns = sortedTxns.filter((t) => t.from === myId || t.to === myId);
  const otherTxns = sortedTxns.filter((t) => t.from !== myId && t.to !== myId);
  const myNet = reconciled[myId] || 0;
  const iAmSettled = Math.abs(myNet) < 0.005;

  // 該收的、該付的、已結清的分開，一眼看得出誰是哪一邊
  const rowIds = useMemo(
    () => [...new Set([...project.memberIds, ...Object.keys(reconciled)])],
    [project.memberIds, reconciled]
  );
  const bucket = (v) => (v > 0.005 ? 0 : v < -0.005 ? 1 : 2);
  const sortedIds = useMemo(() => {
    return [...rowIds].sort((a, b) => {
      const va = reconciled[a] || 0;
      const vb = reconciled[b] || 0;
      const ba = bucket(va);
      const bb = bucket(vb);
      if (ba !== bb) return ba - bb;
      if (ba === 0) return vb - va;
      if (ba === 1) return va - vb;
      return 0;
    });
  }, [rowIds, reconciled]);

  const groups = [
    { key: 0, label: "該收錢", ids: sortedIds.filter((id) => bucket(reconciled[id] || 0) === 0) },
    { key: 1, label: "該付錢", ids: sortedIds.filter((id) => bucket(reconciled[id] || 0) === 1) },
    { key: 2, label: "已結清", ids: sortedIds.filter((id) => bucket(reconciled[id] || 0) === 2) },
  ].filter((g) => g.ids.length > 0);

  const payee = payModalTxn ? membersById[payModalTxn.to] : null;
  const payer = payModalTxn ? membersById[payModalTxn.from] : null;
  // 我是收款方時不需要看自己的匯款資訊，畫面改成單純確認收到
  const iAmPayee = payModalTxn ? payModalTxn.to === myId : false;
  const allSettled = txns.length === 0;

  return (
    <div className="stats">
      {/*
        結算方式擺最上面：底下每一筆建議轉帳都是這個設定算出來的，
        看到不對的名單時，第一件事就是回來改這裡。平常收合成一行。
      */}
      <div className="settle-mode">
        <button className="settle-mode-head" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings}>
          <span className="settle-mode-label">結算方式</span>
          <span className="settle-mode-value">
            {oneMode ? `${membersById[collectorId]?.name || "?"} 全收發` : "最少轉帳次數"}
          </span>
          <span className={"caret" + (showSettings ? " caret-open" : "")}>›</span>
        </button>
        {showSettings && (
          <div className="settle-mode-body">
            <div className="seg">
              <button className={oneMode ? "on" : ""} onClick={() => onModeChange("one", collectorId)}>
                指定一人全收發
              </button>
              <button className={!oneMode ? "on" : ""} onClick={() => onModeChange("min", project.collectorId)}>
                最少轉帳次數
              </button>
            </div>
            {oneMode && (
              <>
                <div className="settle-mode-sub">收發款人</div>
                <div className="pick-row">
                  {project.memberIds.map((id) => (
                    <button
                      key={id}
                      className={"pick" + (id === collectorId ? " on" : "")}
                      onClick={() => onModeChange("one", id)}
                    >
                      {membersById[id]?.name || "?"}
                      {id === autoCollectorId && <span className="pick-note">墊最多</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="hint-text">
              {oneMode
                ? "所有人先跟他結清，再由他付給該收錢的人。"
                : "自動配對，讓總轉帳次數最少。"}
              <br />
              每人金額無條件進位至{decimals === 0 ? "整數" : `小數 ${decimals} 位`}，最大收款人吸收尾差，確保總和為 0。
            </div>
          </div>
        )}
      </div>

      {/* 再講「你」的部分——大家打開這頁就是要看自己要付多少給誰 */}
      {allSettled ? (
        <div className="settle-hero settle-hero-done">
          <div className="settle-hero-label">全部結清</div>
          <div className="settle-hero-value">帳目已結清 🎉</div>
          <div className="stat-panel-note">沒有任何人需要再轉帳。</div>
        </div>
      ) : (
        <div className={"settle-hero" + (iAmSettled ? " settle-hero-done" : myNet > 0 ? " settle-hero-in" : " settle-hero-out")}>
          <div className="settle-hero-label">{iAmSettled ? "你的部分" : myNet > 0 ? "你可以收回" : "你要付出"}</div>
          <div className="settle-hero-value mono">
            {iAmSettled ? "已結清" : formatMoney(Math.abs(myNet), project.baseCurrency, decimals)}
          </div>
          {myTxns.length > 0 ? (
            <div className="settle-hero-list">
              {myTxns.map((t, i) => (
                <TxnRow
                  key={`${t.from}-${t.to}-${i}`}
                  txn={t}
                  membersById={membersById}
                  currency={project.baseCurrency}
                  decimals={decimals}
                  myId={myId}
                  onPay={setPayModalTxn}
                />
              ))}
            </div>
          ) : (
            <div className="stat-panel-note">你不用再轉帳了，其他人之間還有帳要清。</div>
          )}
        </div>
      )}

      {otherTxns.length > 0 && (
        <>
          <button className="stat-head stat-head-btn" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            其他人的轉帳（{otherTxns.length}）
            <span className={"caret" + (showAll ? " caret-open" : "")}>›</span>
          </button>
          {showAll && (
            <div className="txn-list">
              {otherTxns.map((t, i) => (
                <TxnRow
                  key={`${t.from}-${t.to}-${i}`}
                  txn={t}
                  membersById={membersById}
                  currency={project.baseCurrency}
                  decimals={decimals}
                  myId={myId}
                  onPay={setPayModalTxn}
                />
              ))}
            </div>
          )}
        </>
      )}

      <div className="stat-head">目前餘額</div>
      <div className="bal-list">
        {groups.map((g) => (
          <div key={g.key} className="bal-group">
            <div className="bal-group-label">{g.label}</div>
            {g.ids.map((id) => {
              const v = reconciled[id] || 0;
              const inProject = project.memberIds.includes(id);
              const isMe = id === myId;
              return (
                <div key={id} className={"bal-row" + (isMe ? " bal-row-me" : "")}>
                  <span className="bal-name">
                    {membersById[id]?.name || "?"}
                    {isMe && <span className="row-me-tag">你</span>}
                    {!inProject && <span className="bal-out">已不在專案</span>}
                  </span>
                  <span className={"bal-amt mono" + (g.key === 0 ? " text-pos" : g.key === 1 ? " text-neg" : "")}>
                    {g.key === 2 ? formatMoney(0, project.baseCurrency, decimals) : formatSigned(v, project.baseCurrency, decimals)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {payModalTxn && (
        <div className="modal-backdrop" onClick={() => setPayModalTxn(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">{iAmPayee ? "確認收到" : "付款給"}</div>
            <div className="modal-title">{(iAmPayee ? payer : payee)?.name || "?"}</div>
            <div className="modal-amount mono">{formatMoney(payModalTxn.amount, project.baseCurrency, decimals)}</div>
            {!iAmPayee && (
              <div className="list-stack">
                <div className="detail-row">
                  <span className="detail-label">聯絡電話</span>
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
              </div>
            )}
            <div className="hint-text">
              {iAmPayee
                ? "確認後會建一筆轉帳項目，餘額才會跟著更新。"
                : "按「已付款」會幫你建一筆轉帳項目，餘額才會跟著更新。"}
            </div>
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setPayModalTxn(null)}>關閉</button>
              <button
                className="btn-accent"
                onClick={() => {
                  onMarkPaid(payModalTxn);
                  setPayModalTxn(null);
                }}
              >
                {iAmPayee ? "確認收到" : "已付款"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
