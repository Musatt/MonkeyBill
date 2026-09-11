/**
 * 資料庫入口：本機開發用假資料庫，正式網站用 Firebase。
 *
 * 要在本機接上真的 Firebase（測時序、測安全規則），在專案資料夾建一個 .env.local，
 * 內容寫 VITE_USE_REAL_DB=1，再重開 npm run dev。測完記得刪掉那個檔案。
 *
 * 用動態 import 而不是直接 import：正式版打包時 USE_MOCK 固定是 false，
 * 假資料庫那一支會被整個剪掉，不會混進正式網站。
 */
const USE_MOCK = import.meta.env.DEV && import.meta.env.VITE_USE_REAL_DB !== "1";

const impl = USE_MOCK ? import("./mock.js") : import("./firebase.js");

/** 回傳取消訂閱的函式。資料庫模組還沒載完就取消也安全。 */
function lazySubscribe(name, ...args) {
  let unsub = null;
  let cancelled = false;
  impl.then(
    (m) => {
      if (!cancelled) unsub = m[name](...args);
    },
    (err) => {
      // 模組本身載不下來（例如網路斷掉），當成讀取失敗回報
      const onError = args[1];
      if (!cancelled && typeof onError === "function") onError(err);
    }
  );
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export const subscribeLedger = (onData, onError) => lazySubscribe("subscribeLedger", onData, onError);
export const subscribeConnection = (onChange) => lazySubscribe("subscribeConnection", onChange);
export const writeUpdates = async (updates) => (await impl).writeUpdates(updates);
export const usingMock = USE_MOCK;
