import React, { useState, useMemo } from "react";
import { todayStr } from "../lib/format.js";

export function BackupPanel({ data, onRestore }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("export"); // 'export' | 'import'
  const [restoreText, setRestoreText] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [confirmingRestore, setConfirmingRestore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const backupJson = useMemo(() => JSON.stringify(data, null, 2), [data]);

  const summary = useMemo(() => {
    try {
      const parsed = JSON.parse(restoreText);
      return {
        groups: Object.keys(parsed.groups || {}).length,
        projects: Object.keys(parsed.projects || {}).length,
        expenses: Object.keys(parsed.expenses || {}).length,
      };
    } catch {
      return null;
    }
  }, [restoreText]);

  const downloadBackup = () => {
    setDownloadError("");
    try {
      const blob = new Blob([backupJson], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `分帳本備份-${todayStr()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("下載失敗，請改用下面的「複製內容」手動保存");
    }
  };

  const copyBackup = async () => {
    try {
      await navigator.clipboard.writeText(backupJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setDownloadError("複製失敗，請直接選取下面的文字框內容手動複製");
    }
  };

  const tryRestore = () => {
    setRestoreError("");
    try {
      const parsed = JSON.parse(restoreText);
      if (!parsed || typeof parsed !== "object" || !parsed.groups || !parsed.projects || !parsed.expenses) {
        setRestoreError("格式不正確，請確認貼上的是完整的備份內容");
        return;
      }
      setConfirmingRestore(true);
    } catch {
      setRestoreError("無法解析，請確認貼上的是完整的備份內容");
    }
  };

  const doRestore = () => {
    try {
      onRestore(JSON.parse(restoreText));
      setConfirmingRestore(false);
      setRestoreText("");
      setOpen(false);
    } catch {
      setRestoreError("還原失敗，請確認內容正確");
      setConfirmingRestore(false);
    }
  };

  if (!open) {
    return (
      <button className="btn-outline full-width" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>
        資料備份與還原
      </button>
    );
  }

  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="mode-switch">
        <button className={mode === "export" ? "on" : ""} onClick={() => setMode("export")}>匯出備份</button>
        <button className={mode === "import" ? "on" : ""} onClick={() => setMode("import")}>還原備份</button>
      </div>

      {mode === "export" ? (
        <>
          <div className="hint-text" style={{ marginTop: 8 }}>
            建議定期備份，尤其是改版前後，以防萬一。備份內容包含所有群組、專案、項目。
          </div>
          <div className="row-form" style={{ marginTop: 10 }}>
            <button className="btn-ghost" onClick={downloadBackup}>下載檔案</button>
            <button className="btn-accent" onClick={copyBackup}>{copied ? "已複製" : "複製內容"}</button>
          </div>
          {downloadError && <div className="hint-text hint-warn">{downloadError}</div>}
          <textarea
            className="input textarea mono"
            style={{ marginTop: 10, minHeight: 100, fontSize: 11 }}
            readOnly
            value={backupJson}
            onFocus={(e) => e.target.select()}
          />
        </>
      ) : (
        <>
          <div className="hint-text" style={{ marginTop: 8 }}>
            貼上之前匯出的備份內容。還原會蓋掉雲端目前所有資料（包含其他人剛記的帳），請確認清楚再執行。
          </div>
          <textarea
            className="input textarea mono"
            style={{ marginTop: 10, minHeight: 100, fontSize: 11 }}
            placeholder="貼上備份的 JSON 內容"
            value={restoreText}
            onChange={(e) => {
              setRestoreText(e.target.value);
              setRestoreError("");
            }}
          />
          {restoreError && <div className="hint-text hint-warn">{restoreError}</div>}
          {confirmingRestore ? (
            <>
              <div className="hint-text hint-warn" style={{ marginTop: 8 }}>
                即將以這份備份覆蓋全部資料：{summary?.groups} 個群組、{summary?.projects} 個專案、{summary?.expenses} 筆項目。此動作無法復原。
              </div>
              <div className="row-form" style={{ marginTop: 10 }}>
                <button className="btn-ghost" onClick={() => setConfirmingRestore(false)}>取消</button>
                <button className="btn-accent" onClick={doRestore}>確定覆蓋</button>
              </div>
            </>
          ) : (
            <button className="btn-accent full-width" style={{ marginTop: 10 }} disabled={!restoreText.trim()} onClick={tryRestore}>
              還原
            </button>
          )}
        </>
      )}

      <button className="btn-ghost full-width" style={{ marginTop: 10 }} onClick={() => setOpen(false)}>關閉</button>
    </div>
  );
}
