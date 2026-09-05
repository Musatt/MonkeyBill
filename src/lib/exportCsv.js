import { categoryOf } from "./format.js";

function sanitizeFilename(s) {
  return s.replace(/[\\/:*?"<>|]/g, "_").slice(0, 80) || "專案";
}

/** 匯出專案的所有項目成 CSV。成功回傳 true。 */
export function exportCSV(project, expenses, membersById) {
  const header = [
    "日期", "時間", "類型", "類別", "說明",
    "原始金額", "原始幣別", "匯率", `金額(${project.baseCurrency})`,
    "付款人/收款人", "分帳方式", "參與人數",
  ];
  const rows = expenses.map((e) => {
    const itemType = e.itemType || "expense";
    if (itemType === "transfer") {
      return [
        e.date, e.time, "轉帳", "", e.note,
        e.amount, e.currency, e.exchangeRate ?? 1, e.baseAmount,
        `${membersById[e.fromMemberId]?.name || "?"}→${membersById[e.toMemberId]?.name || "?"}`,
        "", "",
      ];
    }
    const payerNames = (e.payers || []).map((p) => membersById[p.memberId]?.name || "?").join("、");
    return [
      e.date, e.time, itemType === "collection" ? "收入" : "支出", categoryOf(e.category).label, e.note,
      e.amount, e.currency, e.exchangeRate ?? 1, e.baseAmount,
      payerNames,
      e.splitType === "equal" ? "均分" : e.splitType === "ratio" ? "比例" : "自訂",
      (e.splitMemberIds || []).length,
    ];
  });

  const csvLines = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","));
  const csv = "﻿" + csvLines.join("\r\n"); // BOM，Excel 開中文才不會亂碼
  try {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sanitizeFilename(project.name)}-項目紀錄.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
