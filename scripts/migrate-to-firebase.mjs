/**
 * 一次性搬家：Supabase → Firebase。搬完、確認沒問題之後這個檔案就可以刪掉。
 *
 * 用法（在 monkey-ledger 資料夾）：
 *   node scripts/migrate-to-firebase.mjs            搬家（Firebase 必須是空的）
 *   node scripts/migrate-to-firebase.mjs --verify   只比對兩邊是否一致，不寫入任何東西
 *
 * 安全設計：
 *   ・動手前先把 Supabase 的資料存一份到 .backups/（不進 git）
 *   ・Firebase 已經有資料就拒絕寫入——絕對不會蓋掉搬過去之後大家新記的帳
 *   ・寫完立刻從 Firebase 讀回來，逐筆比對＋逐人比對餘額，任何一點不同就失敗
 *   ・畫面只印數量與「相同 / 不同」，不印帳目內容
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const load = (p) => import(pathToFileURL(path.join(root, p)).href);

const { FIREBASE_CONFIG, LEDGER_PATH } = await load("src/constants.js");
const { migrate } = await load("src/lib/schema.js");
const { sanitize, invalidKeys, KINDS } = await load("src/lib/fbShape.js");
const { computeBalances, computeItemAllocation } = await load("src/lib/money.js");
const { rulesViolations } = await load("scripts/rulesCheck.mjs");

// 舊資料庫的位置（公開的讀取金鑰，本來就寫在網頁裡）。搬完之後這幾行跟著這個檔案一起刪掉。
const SUPABASE_URL = "https://nalpftuibhsjbtvezssd.supabase.co";
const SUPABASE_KEY = "sb_publishable_vo1ST_2Dak_rmIl62kTKww_SMnFWIB6";

const VERIFY_ONLY = process.argv.includes("--verify");

// 不用 process.exit()：在 Windows 上網路連線還沒關好就強制結束，
// Node 會崩潰並回傳 127，蓋掉原本要回報的成功／失敗。改成丟錯誤、讓程式自然結束。
class Stop extends Error {}
function die(msg) {
  throw new Stop(msg);
}

// FIREBASE_DB_URL 環境變數只給測試用：指向本機的假 Firebase，先把整套流程跑過一遍
const DB_URL = process.env.FIREBASE_DB_URL || FIREBASE_CONFIG?.databaseURL;
const FB = DB_URL ? `${DB_URL.replace(/\/$/, "")}/${LEDGER_PATH}` : null;

/* ---------- 讀兩邊 ---------- */
async function readSupabase() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/app_data?id=eq.main&select=data,updated_at`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) die(`讀 Supabase 失敗：HTTP ${res.status}`);
  const rows = await res.json();
  if (!rows.length || !rows[0].data) die("Supabase 裡沒有資料");
  return rows[0];
}

async function readFirebase() {
  const res = await fetch(`${FB}.json`);
  if (!res.ok) die(`讀 Firebase 失敗：HTTP ${res.status}（安全規則部署了嗎？）`);
  return res.json(); // 空的時候是 null
}

/* ---------- 比對：不管欄位順序，只看值 ---------- */
const canon = (v) =>
  Array.isArray(v) ? v.map(canon)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
      : v;
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

const balances = (d) => Object.fromEntries(Object.values(d.projects).map((p) => {
  const ex = Object.values(d.expenses).filter((e) => e.projectId === p.id);
  return [p.id, computeBalances(p.memberIds, ex, p.settlementDecimals ?? 0)];
}));
const allocations = (d) => Object.fromEntries(Object.values(d.expenses).map((e) => {
  if ((e.itemType || "expense") === "transfer") return [e.id, [e.fromMemberId, e.toMemberId, e.baseAmount]];
  return [e.id, computeItemAllocation(e, d.projects[e.projectId]?.settlementDecimals ?? 0)];
}));

function compare(source, target) {
  const lines = [];
  let ok = true;
  const line = (good, text) => {
    lines.push(`  ${good ? "✔" : "✘"} ${text}`);
    if (!good) ok = false;
  };
  for (const k of KINDS) {
    const a = Object.keys(source[k]).length;
    const b = Object.keys(target[k]).length;
    line(a === b, `${k}：Supabase ${a} 筆，Firebase ${b} 筆`);
  }
  line(same(source, target), "每一筆紀錄的每一個欄位都相同");
  const bs = balances(source), bt = balances(target);
  const people = Object.values(bs).reduce((n, b) => n + Object.keys(b).length, 0);
  line(people > 0 && same(bs, bt), `每個專案每個人的餘額都相同（共比對 ${people} 個人次）`);
  const as = allocations(source), at = allocations(target);
  const n = Object.keys(as).filter((id) => same(as[id], at[id])).length;
  line(n === Object.keys(as).length, `每筆帳的分攤結果都相同（${n} / ${Object.keys(as).length} 筆）`);
  return { ok, lines };
}

/* ---------- 主流程 ---------- */
async function main() {
  if (!FB) die("constants.js 裡的 FIREBASE_CONFIG 還沒填");
  console.log(`目標資料庫：${DB_URL}`);

  const sb = await readSupabase();
  const source = migrate(sb.data);
  console.log(`Supabase 最後更新：${sb.updated_at}`);

  if (VERIFY_ONLY) {
    const fb = await readFirebase();
    if (!fb) die("Firebase 還是空的");
    const { ok, lines } = compare(source, migrate(fb));
    console.log("\n比對 Supabase 與 Firebase：\n" + lines.join("\n"));
    console.log(ok ? "\n✔ 兩邊一致\n" : "\n✘ 兩邊不一致——Supabase 在搬家之後可能又有人寫入\n");
    return ok ? 0 : 1;
  }

  // 1. 先存一份
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.mkdirSync(path.join(root, ".backups"), { recursive: true });
  const backupFile = path.join(root, ".backups", `cutover-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify([sb], null, 2));
  console.log(`已備份到 ${path.relative(root, backupFile)}`);

  // 2. 檢查資料能不能放進 Firebase
  const payload = sanitize({ users: source.users, groups: source.groups, projects: source.projects, expenses: source.expenses });
  const badKeys = invalidKeys(payload);
  if (badKeys.length) die(`有 ${badKeys.length} 個欄位名稱 Firebase 不接受，例如 ${badKeys[0]}`);
  const badRules = rulesViolations(payload);
  if (badRules.length) die(`有 ${badRules.length} 筆紀錄會被安全規則擋下，例如 ${badRules[0]}`);

  // 3. Firebase 必須是空的
  const existing = await readFirebase();
  if (existing) {
    if (compare(source, migrate(existing)).ok) {
      console.log("\nFirebase 裡已經是一模一樣的資料，不需要再搬一次。\n");
      return 0;
    }
    die("Firebase 裡已經有資料而且跟 Supabase 不同。為了不蓋掉任何東西，停止。");
  }

  // 4. 一次寫入（多路徑更新：每一筆各自一個路徑，安全規則也是逐筆檢查）
  const updates = {};
  for (const k of KINDS) for (const [id, v] of Object.entries(payload[k])) updates[`${k}/${id}`] = v;
  const res = await fetch(`${FB}.json?print=silent`, { method: "PATCH", body: JSON.stringify(updates) });
  if (!res.ok) die(`寫入 Firebase 失敗：HTTP ${res.status} ${await res.text()}`);
  console.log(`已寫入 ${Object.keys(updates).length} 筆紀錄`);

  // 5. 讀回來比對
  const target = migrate(await readFirebase());
  const { ok, lines } = compare(source, target);
  console.log("\n從 Firebase 讀回來比對：\n" + lines.join("\n"));
  if (!ok) die("讀回來的資料跟原本不一樣！先不要上線。");
  console.log("\n✔ 搬家完成，資料完全一致。\n");
  return 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (e) => {
    console.error(`\n✘ ${e instanceof Stop ? e.message : e.stack || e}\n`);
    process.exitCode = 1;
  }
);
