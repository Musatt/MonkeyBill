/**
 * 統計頁的時間區間。
 *
 * 日期一律是 "YYYY-MM-DD" 字串。這種格式直接比字串大小就等於比日期先後，
 * 不用轉成 Date——轉 Date 會遇到時區，台灣半夜的帳可能被算到前一天。
 */

export const RANGE_MODES = [
  { id: "all", label: "全部時間" },
  { id: "month", label: "本月" },
  { id: "year", label: "本年" },
  { id: "custom", label: "自訂" },
];

const pad = (n) => String(n).padStart(2, "0");

/** 某年某月有幾天（month 是 1–12）。 */
function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * 算出實際的起訖日（兩端都包含）。「全部時間」回傳 null，代表不篩選。
 * 自訂區間的開始晚於結束時自動對調——比跳錯誤訊息省事，結果也不會錯。
 */
export function resolveRange(mode, today, custom = {}) {
  if (mode === "all") return null;
  const [y, m] = today.split("-").map(Number);
  if (mode === "month") return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
  if (mode === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (mode === "custom") {
    const a = custom.from || today;
    const b = custom.to || today;
    return a <= b ? { from: a, to: b } : { from: b, to: a };
  }
  return null;
}

/** 這一筆的日期在不在區間內。區間是 null（全部時間）一律算在內。 */
export function inRange(date, range) {
  if (!range) return true;
  if (!date) return false; // 沒有日期的帳無法判斷，選了區間就不列入
  return date >= range.from && date <= range.to;
}

/** 顯示用：「2026-09-01 ～ 2026-09-30」。 */
export function rangeText(range) {
  if (!range) return "";
  return range.from === range.to ? range.from : `${range.from} ～ ${range.to}`;
}
