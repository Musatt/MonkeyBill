/* 暱稱規則的回歸測試： node src/lib/names.test.mjs */
import { normalizeName, nameKey, findNameOwner, nameError } from "./names.js";

let pass = 0;
let fail = 0;
const eq = (name, got, want) => {
  const ok = Object.is(got, want);
  if (ok) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} → 得到 ${JSON.stringify(got)}，預期 ${JSON.stringify(want)}`); }
};

const users = {
  u1: { id: "u1", name: "猴子" },
  u2: { id: "u2", name: "軒銘" },
  u3: { id: "u3", name: "阿明", virtual: true, ownerGroupId: "g1" },
  u4: { id: "u4", name: "Joyce" },
};

console.log("\n[正規化]");
eq("去頭尾空白", normalizeName("  猴子  "), "猴子");
eq("中間連續空白收成一個", normalizeName("阿  明"), "阿 明");
eq("null 當空字串", normalizeName(null), "");

console.log("\n[比對鍵：大小寫與空白視為同一個]");
eq("大小寫同一個", nameKey("Joyce") === nameKey("joyce"), true);
eq("前後空白同一個", nameKey(" 猴子 ") === nameKey("猴子"), true);
eq("不同名字不同鍵", nameKey("猴子") === nameKey("軒銘"), false);

console.log("\n[找出名字被誰佔用]");
eq("沒人用回 null", findNameOwner(users, "小黑"), null);
eq("正式成員佔用", findNameOwner(users, "猴子")?.id, "u1");
eq("虛擬成員也算佔用", findNameOwner(users, "阿明")?.id, "u3");
eq("大小寫不同也算佔用", findNameOwner(users, "JOYCE")?.id, "u4");
eq("改名時忽略自己", findNameOwner(users, "猴子", "u1"), null);
eq("改名時仍擋別人的名字", findNameOwner(users, "軒銘", "u1")?.id, "u2");

console.log("\n[能不能用]");
eq("空的不行", nameError("", users), "請輸入暱稱");
eq("只有空白不行", nameError("   ", users), "請輸入暱稱");
eq("保留名稱不行", nameError("後臺管理", users), "這是保留名稱，不能用");
eq("撞到正式成員不行", nameError("猴子", users), "已經有人用這個暱稱了，請換一個");
eq("撞到虛擬成員也不行", nameError("阿明", users), "已經有人用這個暱稱了，請換一個");
eq("只差大小寫也不行", nameError("joyce", users), "已經有人用這個暱稱了，請換一個");
eq("只差空白也不行", nameError(" 猴子 ", users), "已經有人用這個暱稱了，請換一個");
eq("沒撞到就可以", nameError("小黑", users), "");
eq("改自己的名字大小寫可以", nameError("JOYCE", users, "u4"), "");
eq("錯誤訊息不透露對方是不是虛擬成員",
  nameError("猴子", users) === nameError("阿明", users), true);

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
