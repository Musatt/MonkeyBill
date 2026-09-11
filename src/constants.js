/* 全域常數 */

// Firebase 連線設定。從 Firebase 網站「專案設定 → 你的應用程式」複製過來。
// 這些值本來就會出現在網頁原始碼裡、可以公開（不是密碼），
// 真正擋人亂寫的是 database.rules.json 裡的安全規則。
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCMGB9WsJf4XCFGCedYOPY-bV-uqIe-aDY",
  authDomain: "monkey-bill.firebaseapp.com",
  databaseURL: "https://monkey-bill-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "monkey-bill",
  storageBucket: "monkey-bill.firebasestorage.app",
  messagingSenderId: "130584232974",
  appId: "1:130584232974:web:76c7bfb3eee13be096a85f",
};

// 整本帳放在資料庫的這個路徑底下：/ledger/users、/ledger/expenses…
export const LEDGER_PATH = "ledger";

// 通用密碼：進入「後臺管理」用的，也是所有身分密碼的後路。
// 注意這是寫在前端的，任何人打開 DevTools 都看得到——它擋的是手滑，不是有心人。
export const MASTER_PASSWORD = "00000000";

// 保留字：這個暱稱不能被註冊成一般帳號，輸入它會進入後臺管理
export const BACKSTAGE_NAME = "後臺管理";

export const CATEGORIES = [
  { id: "food", label: "飲食", color: "#E8A33D" },
  { id: "fun", label: "娛樂", color: "#B98BD6" },
  { id: "stay", label: "住宿", color: "#5DA9E8" },
  { id: "transport", label: "交通", color: "#4CAF7D" },
  { id: "gear", label: "用具", color: "#E8846B" },
  { id: "other", label: "其他", color: "#9AA3AF" },
];

export const CURRENCY_DECIMALS = { TWD: 0, JPY: 0, USD: 2, EUR: 2, KRW: 0, CNY: 2, HKD: 2, GBP: 2 };
export const CURRENCY_LIST = ["TWD", "JPY", "USD", "EUR"];
