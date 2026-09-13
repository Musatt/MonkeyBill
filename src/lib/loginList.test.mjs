/* 登入名單排序與搜尋的回歸測試： node src/lib/loginList.test.mjs */
import { idTime, sortByCreation, searchUsers } from "./loginList.js";

let pass = 0;
let fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} → 得到 ${JSON.stringify(got)}，預期 ${JSON.stringify(want)}`); }
};

const T = (ms) => ms.toString(36);
const t1 = Date.UTC(2026, 7, 9, 15, 9);
const t2 = Date.UTC(2026, 7, 9, 16, 0);
const t3 = Date.UTC(2026, 8, 1, 10, 0);
const u = (id, name, createdAt = 1) => ({ id, name, createdAt });

console.log("\n[從 id 讀時間]");
eq("正常 id", idTime(`mem_${T(t1)}_abc123`), t1);
eq("沒有時間段", Number.isNaN(idTime("a")), true);
eq("空的", Number.isNaN(idTime(undefined)), true);
eq("解出來是 1970 年這種怪時間就不採用", Number.isNaN(idTime("mem_zz_abc")), true);

console.log("\n[依建立順序排]");
{
  // 舊帳號 createdAt 全部一樣（升級時被蓋掉），要靠 id 裡的時間
  const users = [
    u(`mem_${T(t3)}_c`, "後來加入", 5),
    u(`mem_${T(t1)}_a`, "第一個", 5),
    u(`mem_${T(t2)}_b`, "第二個", 5),
  ];
  eq("createdAt 都一樣時用 id 的時間", sortByCreation(users, {}).map((x) => x.name), ["第一個", "第二個", "後來加入"]);
}
{
  // 同一毫秒建立的三個人：照群組名單裡的順序
  const ids = ["mem_" + T(t1) + "_zz", "mem_" + T(t1) + "_aa", "mem_" + T(t1) + "_mm"];
  const users = [u(ids[1], "乙"), u(ids[2], "丙"), u(ids[0], "甲")];
  const groups = { g: { id: "g_" + T(t1) + "_x", memberIds: [ids[0], ids[1], ids[2]] } };
  eq("同時建立的人照群組名單順序", sortByCreation(users, groups).map((x) => x.name), ["甲", "乙", "丙"]);
  eq("不在任何群組的同時建立者排在後面", sortByCreation([...users, u("mem_" + T(t1) + "_q", "孤單")], groups).map((x) => x.name), ["甲", "乙", "丙", "孤單"]);
}
{
  const users = [u("x", "B", 1), u("y", "A", 1)];
  eq("連群組都分不出來就比名字，順序固定", sortByCreation(users, {}).map((x) => x.name), ["A", "B"]);
  eq("不會改到原本的陣列", users.map((x) => x.name), ["B", "A"]);
}

console.log("\n[搜尋]");
{
  const list = [u("1", "猴子"), u("2", "小猴"), u("3", "Joyce"), u("4", "軒銘")];
  eq("空白查詢回傳全部", searchUsers(list, "  ").length, 4);
  eq("部分符合", searchUsers(list, "猴").map((x) => x.name), ["猴子", "小猴"]);
  eq("不分大小寫", searchUsers(list, "joy").map((x) => x.name), ["Joyce"]);
  eq("前後空白不影響", searchUsers(list, " 軒 ").map((x) => x.name), ["軒銘"]);
  eq("找不到回傳空", searchUsers(list, "阿明").length, 0);
  eq("搜尋不會打亂原本的排序", searchUsers(list, "猴").map((x) => x.id), ["1", "2"]);
}

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
