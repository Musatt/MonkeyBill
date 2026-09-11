/**
 * 正式資料庫：Firebase Realtime Database。
 *
 * 跟以前 Supabase 的最大差別是「推」而不是「拉」：
 * 瀏覽器跟資料庫之間保持一條連線，別人改了帳，資料庫會主動推過來，
 * 不用每 20 秒整包重新下載一次。第一次打開下載全部，之後只傳改動的那一筆。
 *
 * 初始化是延後的（第一次用到才連線），import 這個檔案本身不會有任何副作用。
 */
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, update } from "firebase/database";
import { FIREBASE_CONFIG, LEDGER_PATH } from "../../constants.js";

let db = null;
function database() {
  if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.databaseURL) {
    throw new Error("還沒設定 Firebase：constants.js 裡的 FIREBASE_CONFIG 是空的");
  }
  if (!db) db = getDatabase(initializeApp(FIREBASE_CONFIG));
  return db;
}

/**
 * 訂閱整本帳。onData 會收到原始資料（可能缺欄位，呼叫端要自己補形狀），
 * 沒有任何資料時收到 null——那代表伺服器確認過「真的是空的」，不是讀取失敗。
 * 讀取失敗（例如安全規則擋下、還沒設定）會走 onError。
 */
export function subscribeLedger(onData, onError) {
  try {
    return onValue(
      ref(database(), LEDGER_PATH),
      (snap) => onData(snap.val()),
      (err) => onError(err)
    );
  } catch (err) {
    onError(err);
    return () => {};
  }
}

/** 連線狀態：手機切到背景、網路斷掉時會變 false，重新連上變 true。 */
export function subscribeConnection(onChange) {
  try {
    return onValue(ref(database(), ".info/connected"), (snap) => onChange(!!snap.val()));
  } catch {
    onChange(false);
    return () => {};
  }
}

/**
 * 多路徑更新：{ "expenses/e1": {...}, "users/u2": null }
 * 一次送出，全部成功或全部失敗。
 * Firebase 會先在本機套用（畫面立刻更新），伺服器確認後 Promise 才完成；
 * 離線時會排隊，連上後自動送出。
 */
export function writeUpdates(updates) {
  return update(ref(database(), LEDGER_PATH), updates);
}
