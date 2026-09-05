import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseGet, supabaseSet } from "./supabase.js";
import { diffData, applyDiff, isEmptyDiff, emptyData } from "./merge.js";
import { migrate } from "./schema.js";
import { POLL_INTERVAL_MS } from "../constants.js";

/**
 * 寫入策略：先讀雲端 → 把「自己動過的那幾筆」套上去 → 再寫回。
 * 兩個人同時記帳時不會互相整包蓋掉。
 *
 * 寫入失敗時：畫面保留你剛才的修改（樂觀更新），把 diff 留在佇列裡，
 * 並回報 saveState 讓 UI 明確顯示「還沒存到雲端」，可以手動重試。
 */
export function useStore() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  // status: 'idle' | 'saving' | 'error'
  const [saveState, setSaveState] = useState({ status: "idle", error: null, pending: 0 });

  const pendingRef = useRef([]); // 尚未成功寫入雲端的 diff
  const chainRef = useRef(Promise.resolve());
  const dataRef = useRef(null);

  const setBoth = useCallback((next) => {
    dataRef.current = next;
    setData(next);
  }, []);

  /* ---------- 初次載入 ---------- */
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    (async () => {
      try {
        const remote = await supabaseGet(); // 失敗會 throw，不會被誤判成空資料庫
        if (cancelled) return;
        // 走到這裡代表讀取成功（失敗會 throw）。所以「空的」就是真的空的，
        // 直接顯示空畫面讓使用者自己建身分與群組，不寫入任何範例資料。
        setBoth(remote && remote.groups ? migrate(remote) : emptyData());
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadCount, setBoth]);

  /* ---------- 寫入 ---------- */
  const flush = useCallback(async () => {
    if (pendingRef.current.length === 0) return;
    const batchSize = pendingRef.current.length;
    const batch = pendingRef.current.slice(0, batchSize);
    setSaveState({ status: "saving", error: null, pending: batchSize });
    try {
      const remote = await supabaseGet();
      let merged = remote && remote.groups ? migrate(remote) : emptyData();
      for (const job of batch) {
        merged = job.replace ? job.data : applyDiff(merged, job.diff);
      }
      await supabaseSet(merged);
      pendingRef.current = pendingRef.current.slice(batchSize);
      if (pendingRef.current.length === 0) {
        // 沒有更新的本地修改在排隊，才把合併結果（含別人的新紀錄）套回畫面
        setBoth(merged);
        setSaveState({ status: "idle", error: null, pending: 0 });
      } else {
        setSaveState({ status: "saving", error: null, pending: pendingRef.current.length });
      }
    } catch (e) {
      setSaveState({ status: "error", error: e.message || String(e), pending: pendingRef.current.length });
      throw e;
    }
  }, [setBoth]);

  const schedule = useCallback(() => {
    // 串成一條鏈，避免多次「讀→改→寫」互相插隊
    chainRef.current = chainRef.current.then(
      () => flush().catch(() => {}),
      () => flush().catch(() => {})
    );
  }, [flush]);

  const persist = useCallback(
    (updater, options = {}) => {
      const prev = dataRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (options.replace) {
        pendingRef.current = [{ replace: true, data: next }];
      } else {
        const diff = diffData(prev, next);
        if (isEmptyDiff(diff)) return;
        pendingRef.current = [...pendingRef.current, { diff }];
      }
      setBoth(next); // 樂觀更新：畫面先反應，雲端稍後跟上
      schedule();
    },
    [schedule, setBoth]
  );

  const retrySave = useCallback(() => {
    schedule();
  }, [schedule]);

  /* ---------- 讀取（背景輪詢 / 手動同步） ---------- */
  const refresh = useCallback(async () => {
    // 還有沒存上去的修改時不要拉遠端，否則會把本地未存的東西蓋掉
    if (pendingRef.current.length > 0) {
      schedule();
      return;
    }
    try {
      const fresh = await supabaseGet();
      if (fresh && fresh.groups && pendingRef.current.length === 0) {
        setBoth(migrate(fresh));
      }
    } catch {
      // 背景同步失敗就繼續顯示現有資料，不打斷操作
    }
  }, [schedule, setBoth]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, [refresh]);

  const retry = useCallback(() => setReloadCount((c) => c + 1), []);

  return { data, loading, err, persist, retry, refresh, saveState, retrySave };
}
