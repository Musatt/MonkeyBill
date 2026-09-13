/* 統計時間區間的回歸測試： node src/lib/dateRange.test.mjs */
import { resolveRange, inRange, rangeText } from "./dateRange.js";

let pass = 0;
let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} → 得到 ${JSON.stringify(got)}，預期 ${JSON.stringify(want)}`); }
};

console.log("\n[全部時間]");
eq("不篩選", resolveRange("all", "2026-09-13"), null);
eq("任何日期都算在內", inRange("1999-01-01", null), true);

console.log("\n[本月]");
eq("九月是 30 天", resolveRange("month", "2026-09-13"), { from: "2026-09-01", to: "2026-09-30" });
eq("十二月不會跑到明年", resolveRange("month", "2026-12-31"), { from: "2026-12-01", to: "2026-12-31" });
eq("平年二月 28 天", resolveRange("month", "2026-02-10"), { from: "2026-02-01", to: "2026-02-28" });
eq("閏年二月 29 天", resolveRange("month", "2028-02-10"), { from: "2028-02-01", to: "2028-02-29" });
eq("一月一號當天", resolveRange("month", "2027-01-01"), { from: "2027-01-01", to: "2027-01-31" });

console.log("\n[本年]");
eq("整年", resolveRange("year", "2026-09-13"), { from: "2026-01-01", to: "2026-12-31" });

console.log("\n[自訂]");
eq("照填的", resolveRange("custom", "2026-09-13", { from: "2026-08-20", to: "2026-08-25" }), { from: "2026-08-20", to: "2026-08-25" });
eq("開始晚於結束自動對調", resolveRange("custom", "2026-09-13", { from: "2026-08-25", to: "2026-08-20" }), { from: "2026-08-20", to: "2026-08-25" });
eq("沒填就用今天", resolveRange("custom", "2026-09-13", {}), { from: "2026-09-13", to: "2026-09-13" });

console.log("\n[在不在區間內：兩端都要包含]");
const r = { from: "2026-08-22", to: "2026-08-24" };
eq("開始當天算", inRange("2026-08-22", r), true);
eq("結束當天算", inRange("2026-08-24", r), true);
eq("中間算", inRange("2026-08-23", r), true);
eq("前一天不算", inRange("2026-08-21", r), false);
eq("後一天不算", inRange("2026-08-25", r), false);
eq("跨月的字串比較正確（09 > 08）", inRange("2026-09-01", r), false);
eq("跨年的字串比較正確", inRange("2025-12-31", { from: "2026-01-01", to: "2026-12-31" }), false);
eq("沒有日期的帳不列入", inRange(undefined, r), false);

console.log("\n[顯示文字]");
eq("區間", rangeText({ from: "2026-09-01", to: "2026-09-30" }), "2026-09-01 ～ 2026-09-30");
eq("同一天只寫一次", rangeText({ from: "2026-09-13", to: "2026-09-13" }), "2026-09-13");
eq("全部時間不寫", rangeText(null), "");

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
