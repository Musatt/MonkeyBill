/* 金額算式的回歸測試： node src/lib/calc.test.mjs */
import { evalAmount, isExpression, groupDigits } from "./calc.js";

let pass = 0;
let fail = 0;
const eq = (name, got, want) => {
  const ok = Object.is(got, want);
  if (ok) { pass++; console.log(`  ✔ ${name}`); }
  else { fail++; console.log(`  ✘ ${name} → 得到 ${JSON.stringify(got)}，預期 ${JSON.stringify(want)}`); }
};

console.log("\n[基本運算]");
eq("純數字", evalAmount("120"), 120);
eq("小數", evalAmount("120.5"), 120.5);
eq("加法", evalAmount("120+80"), 200);
eq("連加（帳單多細項）", evalAmount("120+80+45"), 245);
eq("減法", evalAmount("500-120"), 380);
eq("乘法", evalAmount("80*2"), 160);
eq("除法", evalAmount("500/4"), 125);
eq("先乘除後加減", evalAmount("120+80*2"), 280);
eq("括號改變順序", evalAmount("(120+80)*2"), 400);
eq("巢狀括號", evalAmount("((10+5)*2)+70"), 100);
eq("負號開頭", evalAmount("-50"), -50);
eq("全形運算符", evalAmount("120＋80"), 200);
eq("× ÷ 符號", evalAmount("80×2"), 160);
eq("忽略千分位逗號", evalAmount("1,200+800"), 2000);
eq("忽略空白", evalAmount(" 120 + 80 "), 200);
eq("浮點誤差修正", evalAmount("1.1+2.2"), 3.3);

console.log("\n[算不出來要回 null，不能亂給數字]");
eq("空字串", evalAmount(""), null);
eq("只有空白", evalAmount("   "), null);
eq("寫到一半", evalAmount("120+"), null);
eq("只有運算符", evalAmount("+"), null);
eq("括號沒關", evalAmount("(120+80"), null);
eq("括號多關", evalAmount("120+80)"), null);
eq("除以零", evalAmount("120/0"), null);
eq("英文字", evalAmount("abc"), null);
eq("夾雜文字", evalAmount("120abc"), null);
eq("不是字串", evalAmount(null), null);

console.log("\n[絕對不能執行程式碼]");
eq("函式呼叫", evalAmount("alert(1)"), null);
eq("屬性存取", evalAmount("window.x"), null);
eq("箭頭函式", evalAmount("()=>1"), null);
eq("字串串接", evalAmount("'a'+'b'"), null);

console.log("\n[判斷是不是算式]");
eq("純數字不是算式", isExpression("120"), false);
eq("小數不是算式", isExpression("120.5"), false);
eq("負數不算算式", isExpression("-120"), false);
eq("有加號是算式", isExpression("120+80"), true);
eq("有乘號是算式", isExpression("80*2"), true);
eq("有括號是算式", isExpression("(1+2)"), true);

console.log("\n[千分位]");
eq("四位數", groupDigits("1200"), "1,200");
eq("七位數", groupDigits("1234567"), "1,234,567");
eq("三位數不加", groupDigits("120"), "120");
eq("小數部分不分組", groupDigits("1234.5678"), "1,234.5678");
eq("尾隨小數點保留", groupDigits("1234."), "1,234.");
eq("負數", groupDigits("-1234"), "-1,234");
eq("空字串", groupDigits(""), "");
eq("算式原樣不動", groupDigits("120+80"), "120+80");

console.log(`\n${fail === 0 ? "全部通過" : "有失敗"}：${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
