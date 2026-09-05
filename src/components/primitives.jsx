import React, { useState } from "react";
import { CATEGORIES, CURRENCY_LIST } from "../constants.js";
import { formatMoney } from "../lib/format.js";

export function Chip({ color, children }) {
  return (
    <span className="chip" style={{ background: `${color}22`, color, borderColor: `${color}55` }}>
      {children}
    </span>
  );
}

export function TopBar({ title, subtitle, onBack }) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="backbtn" onClick={onBack} aria-label="返回">
          ‹
        </button>
      )}
      <div className="topbar-text">
        <div className="topbar-title">{title}</div>
        {subtitle && <div className="topbar-sub">{subtitle}</div>}
      </div>
    </div>
  );
}

export function Bar({ pct, color }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

/**
 * 分類佔比長條圖。
 * 長條長度和右邊的百分比都用「佔總額的比例」，兩者同一個基準才不會互相打架。
 * 金額為 0 的分類預設收起來，避免六條空長條稀釋重點。
 */
export function CategoryBarList({ byCategory, itemsByCategory, currency, decimals, getAmount, colorize }) {
  const [expandedSet, setExpandedSet] = useState(() => new Set());
  const [showEmpty, setShowEmpty] = useState(false);

  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  const nonZero = CATEGORIES.filter((c) => Math.abs(byCategory[c.id] || 0) > 0.0000001);
  const emptyCount = CATEGORIES.length - nonZero.length;
  const visible = showEmpty ? CATEGORIES : nonZero;

  const toggle = (id) => {
    setExpandedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (nonZero.length === 0) {
    return <div className="empty-hint">還沒有紀錄</div>;
  }

  return (
    <div className="stat-bars">
      {visible.map((c) => {
        const value = byCategory[c.id] || 0;
        const items = itemsByCategory[c.id] || [];
        const hasItems = items.length > 0;
        const isExpanded = expandedSet.has(c.id);
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={c.id}>
            <button
              type="button"
              className="stat-bar-row stat-bar-clickable"
              disabled={!hasItems}
              onClick={() => toggle(c.id)}
              aria-expanded={isExpanded}
            >
              <Chip color={c.color}>{c.label}</Chip>
              <Bar pct={pct} color={c.color} />
              <span className="mono stat-bar-pct" style={{ color: c.color }}>{pct}%</span>
              <span className="mono stat-bar-value">{formatMoney(value, currency, decimals)}</span>
            </button>
            {isExpanded && (
              <div className="category-expand-list">
                {items.map((item) => {
                  const amt = getAmount(item);
                  const sign = amt < 0 ? "-" : colorize ? "+" : "";
                  return (
                    <div key={item.id} className="related-item-row">
                      <div className="related-item-main">
                        <span className="related-item-note">{item.note}</span>
                        <span className={"mono related-item-amount" + (colorize ? (amt >= 0 ? " text-pos" : " text-neg") : "")}>
                          {sign}
                          {formatMoney(Math.abs(amt), currency, decimals)}
                        </span>
                      </div>
                      <div className="related-item-meta">
                        <span>
                          {item.date} {item.time}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {emptyCount > 0 && (
        <button type="button" className="stat-bars-toggle" onClick={() => setShowEmpty((v) => !v)}>
          {showEmpty ? "收起沒有金額的分類" : `顯示其他 ${emptyCount} 個沒有金額的分類`}
        </button>
      )}
    </div>
  );
}

export function DatePickerBox({ value, onChange }) {
  const [y, m, d] = value.split("-").map((v) => parseInt(v, 10));
  const thisYear = new Date().getFullYear();
  // 一定要包含目前選到的年份，否則編輯舊專案時年份下拉會顯示空白
  const years = Array.from(new Set([...Array.from({ length: 4 }, (_, i) => thisYear - 1 + i), y].filter(Number.isFinite))).sort(
    (a, b) => a - b
  );
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const daysInMonth = (yy, mm) => new Date(yy, mm, 0).getDate();
  const days = Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1);
  const setPart = (ny, nm, nd) => {
    const maxDay = daysInMonth(ny, nm);
    onChange(`${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(nd, maxDay)).padStart(2, "0")}`);
  };
  // 選項裡不寫「年月日」，改用 / 分隔。三個下拉各自要留一個箭頭的位置，
  // 手機上 375px 寬時多那三個字就會把日期擠到切掉。
  return (
    <div className="picker-box picker-box-date">
      <select value={y} onChange={(e) => setPart(parseInt(e.target.value, 10), m, d)} aria-label="年">
        {years.map((yy) => (
          <option key={yy} value={yy}>{yy}</option>
        ))}
      </select>
      <span className="mono colon">/</span>
      <select value={m} onChange={(e) => setPart(y, parseInt(e.target.value, 10), d)} aria-label="月">
        {months.map((mm) => (
          <option key={mm} value={mm}>{String(mm).padStart(2, "0")}</option>
        ))}
      </select>
      <span className="mono colon">/</span>
      <select value={d} onChange={(e) => setPart(y, m, parseInt(e.target.value, 10))} aria-label="日">
        {days.map((dd) => (
          <option key={dd} value={dd}>{String(dd).padStart(2, "0")}</option>
        ))}
      </select>
    </div>
  );
}

export function CurrencySelect({ value, onChange }) {
  const isPreset = CURRENCY_LIST.includes(value);
  const [manualCustom, setManualCustom] = useState(false);
  // 由 value 推導而不是只在掛載時判斷一次，父層改幣別時才會跟著更新
  const showCustom = manualCustom || (!isPreset && value !== "");
  return (
    <>
      <select
        className="input"
        value={showCustom ? "__custom__" : value}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setManualCustom(true);
            onChange("");
          } else {
            setManualCustom(false);
            onChange(e.target.value);
          }
        }}
        aria-label="幣別"
      >
        {CURRENCY_LIST.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
        <option value="__custom__">自訂</option>
      </select>
      {showCustom && (
        <input
          className="input mono"
          style={{ marginTop: 8 }}
          placeholder="輸入幣別代碼，例如 THB"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          maxLength={10}
          aria-label="自訂幣別代碼"
        />
      )}
    </>
  );
}

/** 寫入雲端的狀態列。存檔失敗必須讓使用者看得到，不能無聲失敗。 */
export function SaveBanner({ saveState, onRetry }) {
  if (saveState.status === "idle") return null;
  if (saveState.status === "saving") {
    return (
      <div className="save-banner save-banner-saving">
        <span className="save-banner-text">儲存中…</span>
      </div>
    );
  }
  return (
    <div className="save-banner save-banner-error" role="alert">
      <span className="save-banner-text">
        有 {saveState.pending} 筆修改還沒存到雲端（{saveState.error}）。畫面上看得到，但其他人還看不到。
      </span>
      <button onClick={onRetry}>重試</button>
    </div>
  );
}

/**
 * 會被截斷的文字。
 * 只有真的被 … 截掉時才變成可點，點了用浮動視窗顯示全文——
 * 沒被截斷卻可以點會讓人以為壞掉。
 */
export function TruncText({ text, className, label }) {
  const ref = React.useRef(null);
  const [truncated, setTruncated] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <>
      <span
        ref={ref}
        className={(className || "") + (truncated ? " trunc-tappable" : "")}
        onClick={truncated ? () => setOpen(true) : undefined}
        role={truncated ? "button" : undefined}
        tabIndex={truncated ? 0 : undefined}
        onKeyDown={
          truncated
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpen(true);
                }
              }
            : undefined
        }
      >
        {text}
      </span>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {label && <div className="onboard-eyebrow">{label}</div>}
            <div className="trunc-full">{text}</div>
            <button className="btn-ghost full-width" onClick={() => setOpen(false)}>關閉</button>
          </div>
        </div>
      )}
    </>
  );
}
