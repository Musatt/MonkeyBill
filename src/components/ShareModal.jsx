import React, { useState, useMemo } from "react";
import qrcode from "qrcode-generator";

/**
 * QR code。刻意用白底黑點畫在一張白卡上——深色底的 QR 有些相機掃不到。
 * 四周留 4 個模組的靜空區（quiet zone），這是規格要求，少了會掃不動。
 */
function QrCode({ text, size = 200 }) {
  const { path, total } = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 4;
    const segments = [];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) segments.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
      }
    }
    return { path: segments.join(""), total: count + quiet * 2 };
  }, [text]);

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      shapeRendering="crispEdges"
      role="img"
      aria-label="分享連結的 QR code"
      style={{ display: "block", background: "#fff", borderRadius: 10 }}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}

export function ShareModal({ title, subtitle, url, note, onClose }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share;

  const copy = async () => {
    setCopyError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError("複製失敗，請長按下面的連結手動複製");
    }
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
    } catch {
      // 使用者自己取消分享，不用處理
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="onboard-eyebrow">分享</div>
        <div className="modal-title">{title}</div>
        {subtitle && <div className="hint-text" style={{ marginTop: -4 }}>{subtitle}</div>}

        <div className="qr-wrap">
          <QrCode text={url} />
        </div>
        <div className="hint-text" style={{ textAlign: "center" }}>用手機相機掃描，直接開啟這個畫面</div>

        <div className="share-url mono">{url}</div>

        {note && <div className="hint-text hint-warn">{note}</div>}
        {copyError && <div className="hint-text hint-warn">{copyError}</div>}

        <div className="row-form">
          <button className="btn-ghost" onClick={copy}>{copied ? "已複製" : "複製連結"}</button>
          {canNativeShare ? (
            <button className="btn-accent" onClick={nativeShare}>分享…</button>
          ) : (
            <button className="btn-accent" onClick={onClose}>關閉</button>
          )}
        </div>
        {canNativeShare && (
          <button className="btn-ghost full-width" onClick={onClose}>關閉</button>
        )}
      </div>
    </div>
  );
}
