import React, { useState } from "react";
import { CATEGORIES } from "../constants.js";
import { todayStr, nowHHMM, formatMoney, formatTimestamp, projectDecimals, uid } from "../lib/format.js";
import { evalAmount, isExpression, groupDigits } from "../lib/calc.js";
import { DatePickerBox, CurrencySelect } from "./primitives.jsx";

/**
 * 金額鍵盤：自己畫的計算機，取代系統的數字鍵盤。
 * 金額框是 <button> 不是 <input>，所以手機不會跳出系統鍵盤，只會開這一張。
 * 值先存在這裡，按「完成」才寫回表單，中途按取消不影響原本的金額。
 */
function AmountKeypad({ initial, currency, decimals, onCancel, onConfirm }) {
  const [val, setVal] = useState((initial || "").replace(/,/g, ""));
  const result = evalAmount(val);
  const showExpr = isExpression(val);
  const push = (s) => setVal((v) => v + s);
  const canConfirm = val.trim() === "" || result !== null;

  const rows = [
    [
      { k: "C", cls: "kp-clear", fn: () => setVal("") },
      { k: "(", cls: "kp-fn", fn: () => push("(") },
      { k: ")", cls: "kp-fn", fn: () => push(")") },
      { k: "⌫", cls: "kp-fn", fn: () => setVal((v) => v.slice(0, -1)), label: "刪除一個字元" },
    ],
    [
      { k: "7", fn: () => push("7") },
      { k: "8", fn: () => push("8") },
      { k: "9", fn: () => push("9") },
      { k: "÷", cls: "kp-op", fn: () => push("÷") },
    ],
    [
      { k: "4", fn: () => push("4") },
      { k: "5", fn: () => push("5") },
      { k: "6", fn: () => push("6") },
      { k: "×", cls: "kp-op", fn: () => push("×") },
    ],
    [
      { k: "1", fn: () => push("1") },
      { k: "2", fn: () => push("2") },
      { k: "3", fn: () => push("3") },
      { k: "−", cls: "kp-op", fn: () => push("-") },
    ],
    [
      { k: "0", fn: () => push("0") },
      { k: "00", fn: () => push("00") },
      { k: ".", fn: () => push(".") },
      { k: "＋", cls: "kp-op", fn: () => push("+") },
    ],
  ];

  return (
    <>
      <div className="keypad-backdrop" onClick={onCancel} />
      <div className="keypad-sheet" role="dialog" aria-modal="true" aria-label="金額鍵盤">
        <div className="keypad-display">
          <div className="keypad-value mono">{groupDigits(val) || "0"}</div>
          <div className="keypad-result mono">
            {showExpr && (result === null ? "算式還沒寫完" : `= ${formatMoney(result, currency, decimals)}`)}
          </div>
        </div>
        <div className="keypad-grid">
          {rows.map((row, ri) =>
            row.map((b) => (
              <button
                key={`${ri}-${b.k}`}
                className={"kp " + (b.cls || "")}
                onClick={b.fn}
                aria-label={b.label}
              >
                {b.k}
              </button>
            ))
          )}
        </div>
        <div className="row-form keypad-actions">
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button
            className="btn-accent"
            disabled={!canConfirm}
            onClick={() => onConfirm(result === null ? "" : groupDigits(String(result)))}
          >
            完成
          </button>
        </div>
      </div>
    </>
  );
}

export function AddExpenseForm({ project, allMembers, memberIds, initialValues, isEdit, onSave, onCancel }) {
  const projectMembers = memberIds.map((id) => allMembers[id]).filter(Boolean);
  const decimals = projectDecimals(project);

  const [itemType, setItemType] = useState(initialValues?.itemType || "expense");
  const [category, setCategory] = useState(initialValues?.category || "food");
  const [note, setNote] = useState(initialValues?.note || "");
  // 開編輯時也要補逗號，不然一進來是 1200、動一個字才變成 1,200
  const [amount, setAmount] = useState(initialValues ? groupDigits(String(initialValues.amount)) : "");
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

  const [keypadOpen, setKeypadOpen] = useState(false);

  const payerLabel = itemType === "collection" ? "收款人" : "付款人";
  const payerModeLabels = itemType === "collection" ? ["單一收款人", "多人共同收款"] : ["單一付款人", "多人共同支出"];
  const splitLabel = itemType === "collection" ? "收款方式（誰收多少）" : "分帳方式";
  const splitMemberLabel = itemType === "collection" ? "收款對象" : "分攤成員";

  const needsConversion = currency !== project.baseCurrency;
  const amountNum = evalAmount(amount) || 0;

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
  const lastEditedName = isEdit && initialValues?.lastEditedBy ? allMembers[initialValues.lastEditedBy]?.name || "?" : null;
  const lastEditedAt = isEdit ? formatTimestamp(initialValues?.lastEditedAt) : "";

  return (
    <div className="form">
      <div className="form-title">
        <span>{isEdit ? "編輯項目" : "新增項目"}</span>
        {lastEditedName && (
          <span className="form-title-meta">
            最後編輯：{lastEditedName}
            {lastEditedAt && ` · ${lastEditedAt}`}
          </span>
        )}
      </div>

      {/* 類型決定整張表單長什麼樣，所以放最前面當作情境 */}
      <div className="mode-switch mode-switch-3">
        <button className={itemType === "expense" ? "on" : ""} onClick={() => setItemType("expense")}>支出</button>
        <button className={itemType === "collection" ? "on" : ""} onClick={() => setItemType("collection")}>收入</button>
        <button className={itemType === "transfer" ? "on" : ""} onClick={() => setItemType("transfer")}>轉帳</button>
      </div>
      <div className="form-hint">
        {itemType === "expense" && "有人先墊錢、大家分攤。"}
        {itemType === "collection" && "有錢進來（退款、補助等），由指定的人分。"}
        {itemType === "transfer" && "純粹某人拿錢給某人，不分攤。"}
      </div>

      {/* 金額是這張表單的主角，做大。按下去開自訂鍵盤，不是系統的數字鍵盤。
          幣別直接放下拉選單，它本身就是一格，不用再套一層框。 */}
      <div className="amount-line">
        <button className="amount-box" onClick={() => setKeypadOpen(true)} aria-label="金額">
          <span className={"amount-shown mono" + (amount ? "" : " amount-shown-empty")}>{amount || "0"}</span>
        </button>
        <div className="cur-slot">
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>
      </div>

      {needsConversion && (
          <div className="amount-fx">
            <div className="mode-switch">
              <button className={rateMode === "rate" ? "on" : ""} onClick={() => setRateMode("rate")}>填匯率</button>
              <button className={rateMode === "converted" ? "on" : ""} onClick={() => setRateMode("converted")}>填{project.baseCurrency}金額</button>
            </div>
            {rateMode === "rate" ? (
              <>
                <label className="form-label">匯率 1 {currency} = ? {project.baseCurrency}</label>
                <input className="input mono" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
                <div className="form-hint mono">= {formatMoney(baseAmount, project.baseCurrency, decimals)}</div>
              </>
            ) : (
              <>
                <label className="form-label">對應 {project.baseCurrency} 金額</label>
                <input className="input mono" inputMode="decimal" value={convertedAmount} onChange={(e) => setConvertedAmount(e.target.value)} />
                <div className="form-hint mono">匯率 ≈ {effectiveRate.toFixed(4)}</div>
              </>
            )}
        </div>
      )}

      <label className="form-label">項目說明{itemType === "transfer" ? "（選填）" : ""}</label>
      <input
        className="input"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={itemType === "transfer" ? "例如：結算轉帳" : "例如：酒"}
      />

      {itemType !== "transfer" && (
        <>
          <label className="form-label">類別</label>
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

      {itemType === "transfer" ? (
        <>
          <div className="form-sec">誰給誰</div>
          <div className="row-2">
            <div>
              <label className="form-label">付款人</label>
              <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                {projectMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">收款人</label>
              <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                {projectMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>
          {fromId === toId && <div className="form-hint hint-warn">付款人與收款人不能相同</div>}
        </>
      ) : (
        <>
          <div className="form-sec">{payerLabel}</div>
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
              <div className={"form-hint mono" + (Math.abs(payerDiff) < 0.01 ? " hint-ok" : " hint-warn")}>
                {Math.abs(payerDiff) < 0.01 ? `✓ 合計 ${payerSum.toFixed(2)} ${currency}` : `差額 ${payerDiff.toFixed(2)} ${currency}`}
              </div>
            </div>
          )}

          <div className="form-sec">{splitLabel}</div>
          <div className="mode-switch mode-switch-3">
            <button className={splitType === "equal" ? "on" : ""} onClick={() => setSplitType("equal")}>均分</button>
            <button className={splitType === "ratio" ? "on" : ""} onClick={() => setSplitType("ratio")}>比例</button>
            <button className={splitType === "custom" ? "on" : ""} onClick={() => setSplitType("custom")}>自訂金額</button>
          </div>

          {splitType === "equal" && (
            <>
              <div className="split-actions">
                <button className="link-btn" onClick={() => setEqualSel(new Set(projectMembers.map((m) => m.id)))}>全選</button>
                <button className="link-btn" onClick={() => setEqualSel(new Set())}>全不選</button>
              </div>
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
              <div className="form-hint">
                {equalSel.size > 0 && amountNum > 0
                  ? `${equalSel.size} 人均分，每人 ${formatMoney(baseAmount / equalSel.size, project.baseCurrency, decimals)}`
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
              <div className="form-hint">比例總和：{ratioTotal || 0}（填 0 或留空的人不分攤）</div>
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
              <div className={"form-hint mono" + (Math.abs(customDiff) < 0.01 ? " hint-ok" : " hint-warn")}>
                {Math.abs(customDiff) < 0.01 ? `✓ 合計 ${customSum.toFixed(2)} ${currency}` : `差額 ${customDiff.toFixed(2)} ${currency}`}
              </div>
            </div>
          )}
        </>
      )}

      <div className="form-sec">時間</div>
      <div className="row-2">
        <div style={{ flex: 1.3 }}>
          <label className="form-label">日期</label>
          <DatePickerBox value={date} onChange={setDate} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="form-label">時間（24 小時制）</label>
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

      <div className="form-actions">
        {!canSubmit && invalidReason && (
          <div className="form-hint hint-warn" style={{ textAlign: "center", marginBottom: 8 }}>{invalidReason}</div>
        )}
        <div className="row-form">
          <button className="btn-ghost" onClick={onCancel}>取消</button>
          <button className="btn-accent" disabled={!canSubmit} onClick={() => (isEdit ? setConfirmingSave(true) : submit())}>
            {isEdit ? "儲存修改" : "新增項目"}
          </button>
        </div>
      </div>

      {keypadOpen && (
        <AmountKeypad
          initial={amount}
          currency={currency}
          decimals={decimals}
          onCancel={() => setKeypadOpen(false)}
          onConfirm={(v) => {
            setAmount(v);
            setKeypadOpen(false);
          }}
        />
      )}

      {/* 改別人的帳要再確認一次。用彈出視窗，不要讓同一顆按鈕按兩次意思不一樣。 */}
      {confirmingSave && (
        <div className="modal-backdrop" onClick={() => setConfirmingSave(false)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">確認修改</div>
            <div className="modal-title">{note.trim() || (itemType === "transfer" ? "內部轉帳" : "這筆項目")}</div>
            <div className="modal-amount mono">{formatMoney(baseAmount, project.baseCurrency, decimals)}</div>
            <div className="hint-text">存檔後所有人看到的都是新的內容，餘額與結算會跟著重算。</div>
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setConfirmingSave(false)}>再改一下</button>
              <button className="btn-accent" onClick={submit}>確定儲存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
