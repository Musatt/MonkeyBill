import React, { useState, useMemo } from "react";
import { formatMoney, formatSigned, projectDecimals } from "../lib/format.js";
import { computeBalances, reconcileBalances, simplifyDebts, oneCollectorSettlement, biggestPrepayer } from "../lib/money.js";

/** 可以收合的區塊標題：左邊標題、中間一句摘要（收合時也看得到重點）、右邊箭頭 */
function FoldHead({ title, summary, open, onToggle }) {
  return (
    <button className="fold-head" onClick={onToggle} aria-expanded={open}>
      <span className="fold-title">{title}</span>
      {summary && <span className="fold-summary">{summary}</span>}
      <span className={"caret" + (open ? " caret-open" : "")}>›</span>
    </button>
  );
}

/**
 * 一列收付款：誰 → 誰 多少，右邊是動作鍵。
 * 「我」不另外掛標籤，名字換顏色就看得出來。
 */
function TxnRow({ txn, membersById, currency, decimals, myId, onPay }) {
  const iPay = txn.from === myId;
  const iGet = txn.to === myId;
  return (
    <div className="txn">
      <div className="txn-flow">
        <span className={"txn-name" + (iPay ? " name-me" : "")}>{membersById[txn.from]?.name || "?"}</span>
        <span className="txn-arrow" aria-hidden="true">→</span>
        <span className={"txn-name" + (iGet ? " name-me" : "")}>{membersById[txn.to]?.name || "?"}</span>
      </div>
      <span className="txn-amt mono">{formatMoney(txn.amount, currency, decimals)}</span>
      <button className="pay-btn" onClick={() => onPay(txn)}>
        {iPay ? "付款" : iGet ? "已收到" : "登記"}
      </button>
    </div>
  );
}

export function SettlementPage({ project, expenses, membersById, myId, onModeChange, onMarkPaid }) {
  const decimals = projectDecimals(project);
  const currency = project.baseCurrency;
  const balances = useMemo(() => computeBalances(project.memberIds, expenses, decimals), [project.memberIds, expenses, decimals]);
  const reconciled = useMemo(() => reconcileBalances(balances, decimals), [balances, decimals]);
  const [payModalTxn, setPayModalTxn] = useState(null);

  // 除了「我的收付款」，其他區塊一律預設收合：打開頁面先看到大方向，細節要看再點
  const [showBalances, setShowBalances] = useState(false);
  const [showSettled, setShowSettled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showOthers, setShowOthers] = useState(false);

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

  const receiveIds = sortedIds.filter((id) => bucket(reconciled[id] || 0) === 0);
  const payIds = sortedIds.filter((id) => bucket(reconciled[id] || 0) === 1);
  const settledIds = sortedIds.filter((id) => bucket(reconciled[id] || 0) === 2);
  const allSettled = txns.length === 0;

  const balanceSummary = allSettled
    ? "全部結清"
    : [receiveIds.length && `${receiveIds.length} 人該收`, payIds.length && `${payIds.length} 人該付`].filter(Boolean).join(" · ");

  const balRow = (id) => {
    const v = reconciled[id] || 0;
    const b = bucket(v);
    const inProject = project.memberIds.includes(id);
    return (
      <div key={id} className="bal-row">
        <span className={"bal-name" + (id === myId ? " name-me" : "")}>
          {membersById[id]?.name || "?"}
          {!inProject && <span className="bal-out">已不在專案</span>}
        </span>
        <span className={"bal-amt mono" + (b === 0 ? " bal-amt-in" : b === 1 ? " bal-amt-out" : "")}>
          {b === 2 ? formatMoney(0, currency, decimals) : formatSigned(v, currency, decimals)}
        </span>
      </div>
    );
  };

  // 付款視窗有三種情況：我付錢、我收錢、幫別人登記
  const payee = payModalTxn ? membersById[payModalTxn.to] : null;
  const payer = payModalTxn ? membersById[payModalTxn.from] : null;
  const modalRole = !payModalTxn ? null : payModalTxn.from === myId ? "pay" : payModalTxn.to === myId ? "receive" : "proxy";

  return (
    <div className="stats">
      {/* ① 目前餘額：按進結算頁先看大家的狀況 */}
      <FoldHead title="目前餘額" summary={balanceSummary} open={showBalances} onToggle={() => setShowBalances((v) => !v)} />
      {showBalances && (
        <div className="bal-list">
          {receiveIds.length > 0 && (
            <div className="bal-group">
              <div className="bal-group-label">該收錢</div>
              {receiveIds.map(balRow)}
            </div>
          )}
          {payIds.length > 0 && (
            <div className="bal-group">
              <div className="bal-group-label">該付錢</div>
              {payIds.map(balRow)}
            </div>
          )}
          {settledIds.length > 0 && (
            <div className="bal-group">
              <button className="bal-group-label bal-group-toggle" onClick={() => setShowSettled((v) => !v)} aria-expanded={showSettled}>
                已結清（{settledIds.length}）
                <span className={"caret" + (showSettled ? " caret-open" : "")}>›</span>
              </button>
              {showSettled && settledIds.map(balRow)}
            </div>
          )}
        </div>
      )}

      {/* ② 結算方式：底下的收付款都是照這個設定算出來的 */}
      <FoldHead
        title="結算方式"
        summary={oneMode ? `${membersById[collectorId]?.name || "?"} 全收發` : "最少轉帳次數"}
        open={showSettings}
        onToggle={() => setShowSettings((v) => !v)}
      />
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
            {oneMode ? "所有人先跟他結清，再由他付給該收錢的人。" : "自動配對，讓總轉帳次數最少。"}
            <br />
            每人金額無條件進位至{decimals === 0 ? "整數" : `小數 ${decimals} 位`}，最大收款人吸收尾差，確保總和為 0。
          </div>
        </div>
      )}

      {/* ③ 收付款明細：我的直接攤開，其他人的收合 */}
      <div className="sec-head">收付款</div>
      {allSettled ? (
        <div className="settle-hero settle-hero-done">
          <div className="settle-hero-label">全部結清</div>
          <div className="settle-hero-value">帳目已結清 🎉</div>
          <div className="stat-panel-note">沒有任何人需要再轉帳。</div>
        </div>
      ) : (
        <>
          <div className={"settle-hero" + (iAmSettled ? " settle-hero-done" : myNet > 0 ? " settle-hero-in" : " settle-hero-out")}>
            <div className="settle-hero-label">{iAmSettled ? "你的部分" : myNet > 0 ? "你可以收回" : "你要付出"}</div>
            <div className="settle-hero-value mono">
              {iAmSettled ? "已結清" : formatMoney(Math.abs(myNet), currency, decimals)}
            </div>
            {myTxns.length > 0 ? (
              <div className="settle-hero-list">
                {myTxns.map((t, i) => (
                  <TxnRow key={`${t.from}-${t.to}-${i}`} txn={t} membersById={membersById} currency={currency} decimals={decimals} myId={myId} onPay={setPayModalTxn} />
                ))}
              </div>
            ) : (
              <div className="stat-panel-note">你不用再轉帳了，其他人之間還有帳要清。</div>
            )}
          </div>

          {otherTxns.length > 0 && (
            <>
              <FoldHead
                title="其他人的收付款"
                summary={`${otherTxns.length} 筆 · 可以幫忙登記`}
                open={showOthers}
                onToggle={() => setShowOthers((v) => !v)}
              />
              {showOthers && (
                <div className="txn-list">
                  {otherTxns.map((t, i) => (
                    <TxnRow key={`${t.from}-${t.to}-${i}`} txn={t} membersById={membersById} currency={currency} decimals={decimals} myId={myId} onPay={setPayModalTxn} />
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {payModalTxn && (
        <div className="modal-backdrop" onClick={() => setPayModalTxn(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">
              {modalRole === "pay" ? "付款給" : modalRole === "receive" ? "確認收到" : "幫忙登記收付款"}
            </div>
            <div className="modal-title">
              {modalRole === "pay" && (payee?.name || "?")}
              {modalRole === "receive" && `${payer?.name || "?"} 的款項`}
              {modalRole === "proxy" && `${payer?.name || "?"} → ${payee?.name || "?"}`}
            </div>
            <div className="modal-amount mono">{formatMoney(payModalTxn.amount, currency, decimals)}</div>

            {/* 自己收錢時不用看自己的帳號；付款或幫忙登記時才需要收款人的資料 */}
            {modalRole !== "receive" && (
              <div className="list-stack">
                <div className="detail-row">
                  <span className="detail-label">收款人</span>
                  <span>{payee?.name || "?"}</span>
                </div>
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

            {/* 按下去不會直接存：會打開一張填好的轉帳表單，確認後按「新增項目」才算數 */}
            <div className="hint-text">
              {modalRole === "pay" && "付完款再按「已付款」。"}
              {modalRole === "receive" && "確認收到錢之後再按。"}
              {modalRole === "proxy" && `確定 ${payer?.name || "?"} 已經把錢給 ${payee?.name || "?"} 之後再按。`}
              會打開一張填好的轉帳表單，確認沒問題按「新增項目」才會存，餘額也才會更新。
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
                {modalRole === "pay" ? "已付款" : modalRole === "receive" ? "確認收到" : "登記已付款"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
