import { useState, useEffect, useCallback, useRef } from "react";
import { subscribeLedger, subscribeConnection, writeUpdates } from "./db/index.js";
import { diffData, isEmptyDiff, emptyData, pruneOrphans } from "./merge.js";
import { diffToUpdates } from "./fbShape.js";
import { migrate } from "./schema.js";

// 第一次載入最多等多久。Firebase 斷線時不會報錯、只會一直等，
// 不設上限的話使用者會對著「載入中」發呆，不知道是網路問題。
const FIRST_LOAD_TIMEOUT_MS = 15000;

/**
 * 整本帳的資料與存檔。
 *
 * 讀取：訂閱一次，之後別人改了什麼資料庫會主動推過來（不再每 20 秒輪詢）。
 *
 * 寫入：比對改前改後，只把「動到的那幾筆」送出去（多路徑更新）。
 * 每筆帳有自己的路徑，兩個人同時記不同的帳不可能互相蓋掉——
 * 以前要「先讀雲端、合併、再寫回」才做得到，現在是資料結構本身保證的。
 *
 * 畫面先更新（樂觀更新），伺服器確認後才算存好。
 * 離線時寫入會排隊，連線恢復後自動送出；被伺服器拒絕的寫入留著可以重試。
 */
export function useStore() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  // status: 'idle' | 'saving' | 'error'
  const [saveState, setSaveState] = useState({ status: "idle", error: null, pending: 0 });
  const [connected, setConnected] = useState(false);
  // 最後一次確定跟雲端對上的時間：收到推送、寫入被確認、連線恢復都算
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  const dataRef = useRef(null);
  const inflightRef = useRef(0); // 已送出、伺服器還沒確認的寫入
  const failedRef = useRef([]); // 被拒絕的寫入，按「重試」會再送一次

  const setBoth = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  /* ---------- 訂閱 ---------- */
  useEffect(() => {
    let gotFirst = false;
    setLoading(true);
    setErr(null);

    const timer = setTimeout(() => {
      if (!gotFirst) {
        setErr("連不上資料庫（15 秒沒有回應）。請確認網路之後按重試。");
        setLoading(false);
      }
    }, FIRST_LOAD_TIMEOUT_MS);

    const unsubData = subscribeLedger(
      (raw) => {
        // raw 是 null 代表伺服器確認過「真的沒有資料」，不是讀取失敗（失敗走下面的 onError）。
        // 空的就顯示空畫面，絕對不自動寫入任何範例資料。
        setBoth(raw ? pruneOrphans(migrate(raw)) : emptyData());
        setLastSyncedAt(Date.now());
        if (!gotFirst) {
          gotFirst = true;
          clearTimeout(timer);
          setErr(null); // 逾時訊息出現後才連上的話，自動收掉
          setLoading(false);
        }
      },
      (e) => {
        clearTimeout(timer);
        setErr(e?.message || String(e));
        setLoading(false);
      }
    );

    const unsubConn = subscribeConnection((c) => {
      setConnected(c);
      if (c) setLastSyncedAt(Date.now());
    });

    return () => {
      clearTimeout(timer);
      unsubData();
      unsubConn();
    };
  }, [reloadCount, setBoth]);

  /* ---------- 寫入 ---------- */
  const refreshSaveState = useCallback((error) => {
    const pending = inflightRef.current + failedRef.current.length;
    if (failedRef.current.length > 0) setSaveState({ status: "error", error, pending });
    else if (inflightRef.current > 0) setSaveState({ status: "saving", error: null, pending });
    else setSaveState({ status: "idle", error: null, pending: 0 });
  }, []);

  const send = useCallback(
    (updates) => {
      inflightRef.current += 1;
      refreshSaveState(null);
      writeUpdates(updates).then(
        () => {
          inflightRef.current -= 1;
          setLastSyncedAt(Date.now());
          refreshSaveState(null);
        },
        (e) => {
          inflightRef.current -= 1;
          failedRef.current.push(updates);
          refreshSaveState(e?.message || String(e));
        }
      );
    },
    [refreshSaveState]
  );

  const persist = useCallback(
    (updater) => {
      const prev = dataRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      const diff = diffData(prev, next);
      if (isEmptyDiff(diff)) return;
      setBoth(next); // 樂觀更新：畫面先反應
      send(diffToUpdates(diff));
    },
    [send, setBoth]
  );

  /** 把被拒絕的寫入按原本順序合成一次再送（後面的蓋前面的，跟當初的操作順序一致）。 */
  const retrySave = useCallback(() => {
    const batch = failedRef.current;
    failedRef.current = [];
    const merged = Object.assign({}, ...batch);
    if (Object.keys(merged).length > 0) send(merged);
    else refreshSaveState(null);
  }, [send, refreshSaveState]);

  const retry = useCallback(() => setReloadCount((c) => c + 1), []);

  return { data, loading, err, persist, retry, connected, saveState, retrySave, lastSyncedAt };
}
