/* 全域常數 */

export const SUPABASE_URL = "https://nalpftuibhsjbtvezssd.supabase.co";
export const SUPABASE_KEY = "sb_publishable_vo1ST_2Dak_rmIl62kTKww_SMnFWIB6";
export const SUPABASE_TABLE = "app_data";
export const RECORD_ID = "main";

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

// 背景輪詢間隔
export const POLL_INTERVAL_MS = 20000;
