import React, { useState } from "react";
import { CATEGORIES } from "../constants.js";
import { todayStr, nowHHMM, formatMoney, formatTimestamp, projectDecimals, uid } from "../lib/format.js";
import { DatePickerBox, CurrencySelect } from "./primitives.jsx";

export function AddExpenseForm({ project, allMembers, initialValues, isEdit, onSave, onCancel }) {
  const projectMembers = project.memberIds.map((id) => allMembers.find((m) => m.id === id)).filter(Boolean);
  const decimals = projectDecimals(project);

  const [itemType, setItemType] = useState(initialValues?.itemType || "expense");
  const [category, setCategory] = useState(initialValues?.category || "food");
  const [note, setNote] = useState(initialValues?.note || "");
  const [amount, setAmount] = useState(initialValues ? String(initialValues.amount) : "");
  const [currency, setCurrency] = useState(initialValues?.currency || project.baseCurrency);
  const [rateMode, setRateMode] = useState("rate"); // 'rate' | 'converted'
  const [rate, setRate] = useState(initialValues ? String(initialValues.exchangeRate || 1) : "1");
  const [convertedAmount, setConvertedAmount] = useState(initialValues ? String(initialValues.baseAmount || "") : "");
  const [date, setDate] = useState(initialValues?.date || todayStr());
  const initTime = initialValues?.time
    ? initialValues.time.split(":")
    : (() => {
        const n = nowHHMM();
        return [n.hour, n.minute];
      })();
  const [hour, setHour] = useState(initTime[0]);
  const [minute, setMinute] = useState(initTime[1]);
  const [splitType, setSplitType] = useState(initialValues?.splitType || "equal");
  const [equalSel, setEqualSel] = useState(
    () =>
      new Set(
        initialValues?.splitType === "equal"
          ? initialValues.splitMemberIds.filter((id) => project.memberIds.includes(id))
          : projectMembers.map((m) => m.id)
      )
  );
  const [weights, setWeights] = useState(() =>
    initialValues?.splitType === "ratio"
      ? Object.fromEntries(Object.entries(initialValues.splitWeights).map(([k, v]) => [k, String(v)]))
      : {}
  );
  const [customs, setCustoms] = useState(() =>
    initialValues?.splitType === "custom"
      ? Object.fromEntries(Object.entries(initialValues.splitAmounts).map(([k, v]) => [k, String(v)]))
      : {}
  );

  const initialPayers = initialValues?.payers || (projectMembers[0] ? [{ memberId: projectMembers[0].id, amount: 0 }] : []);
  const [payerMode, setPayerMode] = useState(initialPayers.length > 1 ? "multi" : "single");
  const [singlePayerId, setSinglePayerId] = useState(initialPayers[0]?.memberId || projectMembers[0]?.id || "");
  const [payerSel, setPayerSel] = useState(() => new Set(initialPayers.map((p) => p.memberId)));
  const [payerAmounts, setPayerAmounts] = useState(() => Object.fromEntries(initialPayers.map((p) => [p.memberId, String(p.amount)])));

  const [fromId, setFromId] = useState(initialValues?.fromMemberId || projectMembers[0]?.id || "");
  const [toId, setToId] = useState(initialValues?.toMemberId || projectMembers[1]?.id || projectMembers[0]?.id || "");
  const [confirmingSave, setConfirmingSave] = useState(false);

  const payerLabel = itemType === "collection" ? "收款人" : "付款人";
  const payerModeLabels = itemType === "collection" ? ["單一收款人", "多人共同收款"] : ["單一付款人", "多人共同支出"];
  const splitLabel = itemType === "collection" ? "收款方式（誰收多少）" : "分帳方式";
  const splitMemberLabel = itemType === "collection" ? "收款對象" : "分攤成員";

  const needsConversion = currency !== project.baseCurrency;
  const amountNum = parseFloat(amount) || 0;

  let baseAmount = amountNum;
  let effectiveRate = 1;
  if (needsConversion) {
    if (rateMode === "rate") {
      effectiveRate = parseFloat(rate) || 0;
      baseAmount = amountNum * effectiveRate;
    } else {
      baseAmount = parseFloat(convertedAmount) || 0;
      effectiveRate = amountNum > 0 ? baseAmount / amountNum : 0;
    }
  }

  const toggleEqual = (id) =>
    setEqualSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePayer = (id) => {
    setPayerSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // 取消勾選就把金額清掉，不要讓一個灰掉的欄位裡還留著數字
    if (payerSel.has(id)) setPayerAmounts((p) => ({ ...p, [id]: "" }));
  };

  const customSelectedIds = projectMembers.filter((m) => (parseFloat(customs[m.id]) || 0) > 0).map((m) => m.id);
  const ratioSelectedIds = projectMembers.filter((m) => (parseFloat(weights[m.id]) || 0) > 0).map((m) => m.id);

  const customSum = customSelectedIds.reduce((s, id) => s + (parseFloat(customs[id]) || 0), 0);
  const customDiff = amountNum - customSum;
  // 只計入專案內成員的比例，跟實際存檔用的 splitMemberIds 一致
  const ratioTotal = ratioSelectedIds.reduce((s, id) => s + (parseFloat(weights[id]) || 0), 0);
  const payerSelIds = projectMembers.filter((m) => payerSel.has(m.id)).map((m) => m.id);
  const payerSum = payerSelIds.reduce((s, id) => s + (parseFloat(payerAmounts[id]) || 0), 0);
  const payerDiff = amountNum - payerSum;

  const canSubmit =
    !!currency.trim() &&
    (itemType === "transfer"
      ? amountNum > 0 && fromId && toId && fromId !== toId && (!needsConversion || baseAmount > 0)
      : amountNum > 0 &&
        note.trim() &&
        (!needsConversion || baseAmount > 0) &&
        (payerMode === "single" ? !!singlePayerId : payerSelIds.length > 0 && Math.abs(payerDiff) < 0.01) &&
        ((splitType === "equal" && equalSel.size > 0) ||
          (splitType === "ratio" && ratioTotal > 0) ||
          (splitType === "custom" && customSelectedIds.length > 0 && Math.abs(customDiff) < 0.01)));

  const validationMessage = () => {
    if (!currency.trim()) return "請輸入自訂幣別代碼";
    if (amountNum <= 0) return "請輸入金額";
    if (needsConversion && baseAmount <= 0) return "請確認匯率或換算金額";
    if (itemType === "transfer") {
      if (!fromId || !toId) return "請選擇付款人與收款人";
      if (fromId === toId) return "付款人與收款人不能相同";
      return "";
    }
    if (!note.trim()) return "請輸入項目說明";
    if (payerMode === "single" && !singlePayerId) return `請選擇${payerLabel}`;
    if (payerMode === "multi" && payerSelIds.length === 0) return `請至少選擇一位${payerLabel}`;
    if (payerMode === "multi" && Math.abs(payerDiff) >= 0.01)
      return payerDiff > 0
        ? `${payerLabel}金額還少 ${payerDiff.toFixed(2)} ${currency}`
        : `${payerLabel}金額超過總額 ${Math.abs(payerDiff).toFixed(2)} ${currency}`;
    if (splitType === "equal" && equalSel.size === 0) return `請至少選擇一位${splitMemberLabel}`;
    if (splitType === "ratio" && ratioTotal <= 0) return "請輸入至少一人的比例";
    if (splitType === "custom" && customSelectedIds.length === 0) return "請至少輸入一人的金額";
    if (splitType === "custom" && Math.abs(customDiff) >= 0.01)
      return customDiff > 0
        ? `分攤金額還少 ${customDiff.toFixed(2)} ${currency}`
        : `分攤金額超過總額 ${Math.abs(customDiff).toFixed(2)} ${currency}`;
    return "";
  };

  const submit = () => {
    const id = isEdit ? initialValues.id : uid("e");
    const createdAt = isEdit ? initialValues.createdAt : Date.now();
    let obj;
    if (itemType === "transfer") {
      obj = {
        id,
        projectId: project.id,
        itemType: "transfer",
        note: note.trim() || "內部轉帳",
        amount: amountNum,
        currency,
        exchangeRate: effectiveRate,
        baseAmount,
        fromMemberId: fromId,
        toMemberId: toId,
        date,
        time: `${hour}:${minute}`,
        createdAt,
      };
    } else {
      const payers =
        payerMode === "single"
          ? [{ memberId: singlePayerId, amount: amountNum }]
          : payerSelIds.map((id2) => ({ memberId: id2, amount: parseFloat(payerAmounts[id2]) || 0 }));
      obj = {
        id,
        projectId: project.id,
        itemType,
        category,
        note: note.trim(),
        amount: amountNum,
        currency,
        exchangeRate: effectiveRate,
        baseAmount,
        payers,
        date,
        time: `${hour}:${minute}`,
        splitType,
        splitMemberIds: splitType === "equal" ? Array.from(equalSel) : splitType === "ratio" ? ratioSelectedIds : customSelectedIds,
        splitWeights: splitType === "ratio" ? Object.fromEntries(ratioSelectedIds.map((k) => [k, parseFloat(weights[k]) || 0])) : {},
        splitAmounts: splitType === "custom" ? Object.fromEntries(customSelectedIds.map((id2) => [id2, parseFloat(customs[id2]) || 0])) : {},
        createdAt,
      };
    }
    onSave(obj);
  };

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const invalidReason = validationMessage();

  // 「最後編輯」只在這裡顯示。列表上每筆都掛一個名字會讓畫面上的人名太多。
  const lastEditedName = isEdit && initialValues?.lastEditedBy
    ? allMembers.find((m) => m.id === initialValues.lastEditedBy)?.name || "?"
    : null;
  const lastEditedAt = isEdit ? formatTimestamp(initialValues?.lastEditedAt) : "";

  return (
    <div className="screen">
      <div className="onboard-eyebrow" style={{ marginBottom: 4 }}>{isEdit ? "編輯項目" : "新增項目"}</div>
      {lastEditedName && (
        <div className="hint-text">
          最後編輯：{lastEditedName}
          {lastEditedAt && ` · ${lastEditedAt}`}
        </div>
      )}

      <div className="section-label">項目類型</div>
      <div className="mode-switch mode-switch-3">
        <button className={itemType === "expense" ? "on" : ""} onClick={() => setItemType("expense")}>支出</button>
        <button className={itemType === "collection" ? "on" : ""} onClick={() => setItemType("collection")}>收入</button>
        <button className={itemType === "transfer" ? "on" : ""} onClick={() => setItemType("transfer")}>轉帳</button>
      </div>
      <div className="hint-text">
        {itemType === "expense" && "有人先墊錢、大家分攤。"}
        {itemType === "collection" && "有錢進來（退款、補助等），由指定的人分。"}
        {itemType === "transfer" && "純粹某人拿錢給某人，不分攤。"}
      </div>

      {itemType !== "transfer" && (
        <>
          <div className="section-label">類別</div>
          <div className="cat-grid">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                className={"cat-btn" + (category === c.id ? " cat-btn-on" : "")}
                style={{ "--cat-color": c.color }}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="section-label">項目說明{itemType === "transfer" ? "(選填)" : ""}</div>
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={itemType === "transfer" ? "例如：結算轉帳" : "例如：酒"}
      />

      <div className="row-2">
        <div style={{ flex: 2 }}>
          <div className="section-label">金額</div>
          <input className="input mono" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="section-label">幣別</div>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>
      </div>

      {needsConversion && (
        <div className="card subtle">
          <div className="mode-switch">
            <button className={rateMode === "rate" ? "on" : ""} onClick={() => setRateMode("rate")}>填匯率</button>
            <button className={rateMode === "converted" ? "on" : ""} onClick={() => setRateMode("converted")}>填{project.baseCurrency}金額</button>
          </div>
          {rateMode === "rate" ? (
            <>
              <div className="section-label">匯率 (1 {currency} = ? {project.baseCurrency})</div>
              <input className="input mono" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
              <div className="hint-text mono">= {formatMoney(baseAmount, project.baseCurrency, decimals)}</div>
            </>
          ) : (
            <>
              <div className="section-label">對應 {project.baseCurrency} 金額</div>
              <input className="input mono" inputMode="decimal" value={convertedAmount} onChange={(e) => setConvertedAmount(e.target.value)} />
              <div className="hint-text mono">匯率 ≈ {effectiveRate.toFixed(4)}</div>
            </>
          )}
        </div>
      )}

      {itemType === "transfer" ? (
        <>
          <div className="row-2">
            <div>
              <div className="section-label">付款人</div>
              <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {projectMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="section-label">收款人</div>
              <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                {projectMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          {fromId === toId && <div className="hint-text hint-warn">付款人與收款人不能相同</div>}
        </>
      ) : (
        <>
          <div className="section-label">{payerLabel}</div>
          <div className="mode-switch">
            <button className={payerMode === "single" ? "on" : ""} onClick={() => setPayerMode("single")}>{payerModeLabels[0]}</button>
            <button className={payerMode === "multi" ? "on" : ""} onClick={() => setPayerMode("multi")}>{payerModeLabels[1]}</button>
          </div>
          {payerMode === "single" ? (
            <select className="input" value={singlePayerId} onChange={(e) => setSinglePayerId(e.target.value)}>
              {projectMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          ) : (
            <div className="split-list">
              {projectMembers.map((m) => (
                <div key={m.id} className="split-row">
                  <button
                    className={"mini-check" + (payerSel.has(m.id) ? " on" : "")}
                    onClick={() => togglePayer(m.id)}
                    aria-label={`選擇 ${m.name}`}
                  >
                    {payerSel.has(m.id) ? "✓" : ""}
                  </button>
                  <span className="split-row-name">{m.name}</span>
                  <input
                    className="input small mono"
                    inputMode="decimal"
                    placeholder="0"
                    disabled={!payerSel.has(m.id)}
                    value={payerAmounts[m.id] || ""}
                    onChange={(e) => setPayerAmounts((p) => ({ ...p, [m.id]: e.target.value }))}
                  />
                </div>
              ))}
              <div className={"hint-text mono" + (Math.abs(payerDiff) < 0.01 ? " hint-ok" : " hint-warn")}>
                {Math.abs(payerDiff) < 0.01 ? `✓ 合計 ${payerSum.toFixed(2)} ${currency}` : `差額 ${payerDiff.toFixed(2)} ${currency}`}
              </div>
            </div>
          )}
        </>
      )}

      <div className="row-2">
        <div style={{ flex: 1.2 }}>
          <div className="section-label">日期</div>
          <DatePickerBox value={date} onChange={setDate} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="section-label">時間（24小時制）</div>
          <div className="picker-box">
            <select value={hour} onChange={(e) => setHour(e.target.value)} aria-label="時">
              {hours.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <span className="mono colon">:</span>
            <select value={minute} onChange={(e) => setMinute(e.target.value)} aria-label="分">
              {minutes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {itemType !== "transfer" && (
        <>
          <div className="section-label">{splitLabel}</div>
          <div className="mode-switch mode-switch-3">
            <button className={splitType === "equal" ? "on" : ""} onClick={() => setSplitType("equal")}>均分</button>
            <button className={splitType === "ratio" ? "on" : ""} onClick={() => setSplitType("ratio")}>比例</button>
            <button className={splitType === "custom" ? "on" : ""} onClick={() => setSplitType("custom")}>自訂金額</button>
          </div>

          {splitType === "equal" && (
            <>
              <div className="member-chip-row">
                {projectMembers.map((m) => (
                  <button
                    key={m.id}
                    className={"member-tag selectable" + (equalSel.has(m.id) ? " member-tag-on" : "")}
                    onClick={() => toggleEqual(m.id)}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
              <div className="hint-text">
                {equalSel.size > 0 && amountNum > 0
                  ? `${equalSel.size} 人均分，每人 ${formatMoney(baseAmount / equalSel.size, project.baseCurrency, 2)}`
                  : `已選 ${equalSel.size} 人`}
              </div>
            </>
          )}

          {splitType === "ratio" && (
            <div className="split-list">
              {projectMembers.map((m) => {
                const on = (parseFloat(weights[m.id]) || 0) > 0;
                return (
                  <div key={m.id} className="split-row">
                    <span className={"mini-check mini-check-static" + (on ? " on" : "")}>{on ? "✓" : ""}</span>
                    <span className="split-row-name">{m.name}</span>
                    <input
                      className="input small mono"
                      inputMode="decimal"
                      placeholder="0"
                      value={weights[m.id] || ""}
                      onChange={(e) => setWeights((w) => ({ ...w, [m.id]: e.target.value }))}
                    />
                  </div>
                );
              })}
              <div className="hint-text">比例總和：{ratioTotal || 0}（填 0 或留空的人不分攤）</div>
            </div>
          )}

          {splitType === "custom" && (
            <div className="split-list">
              {projectMembers.map((m) => {
                const on = (parseFloat(customs[m.id]) || 0) > 0;
                return (
                  <div key={m.id} className="split-row">
                    <span className={"mini-check mini-check-static" + (on ? " on" : "")}>{on ? "✓" : ""}</span>
                    <span className="split-row-name">{m.name}</span>
                    <input
                      className="input small mono"
                      inputMode="decimal"
                      placeholder="0"
                      value={customs[m.id] || ""}
                      onChange={(e) => setCustoms((c) => ({ ...c, [m.id]: e.target.value }))}
                    />
                  </div>
                );
              })}
              <div className={"hint-text mono" + (Math.abs(customDiff) < 0.01 ? " hint-ok" : " hint-warn")}>
                {Math.abs(customDiff) < 0.01 ? `✓ 合計 ${customSum.toFixed(2)} ${currency}` : `差額 ${customDiff.toFixed(2)} ${currency}`}
              </div>
            </div>
          )}
        </>
      )}

      {/* 黏在底部的操作列，長表單不用每次滑到最下面才能存 */}
      <div className="form-actions">
        {!canSubmit && !confirmingSave && invalidReason && (
          <div className="hint-text hint-warn" style={{ textAlign: "center", marginBottom: 8 }}>{invalidReason}</div>
        )}
        {isEdit && confirmingSave ? (
          <div className="row-form">
            <button className="btn-ghost" onClick={() => setConfirmingSave(false)}>取消</button>
            <button className="btn-accent" onClick={submit}>確定儲存修改</button>
          </div>
        ) : (
          <div className="row-form">
            <button className="btn-ghost" onClick={onCancel}>取消</button>
            <button className="btn-accent" disabled={!canSubmit} onClick={() => (isEdit ? setConfirmingSave(true) : submit())}>
              {isEdit ? "儲存修改" : "新增項目"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
