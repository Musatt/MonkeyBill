/**
 * 金額欄位的小算式支援。
 *
 * 帳單常常有好幾個細項（120+80+45），能直接在欄位裡算完就不用跳去開計算機。
 * 用自己寫的解析器而不是 eval——eval 會執行任意程式碼，
 * 而且這個字串是使用者輸入、還會被同步到雲端給別人的瀏覽器讀。
 *
 * 支援：數字、小數、+ - * / 、括號、千分位逗號（會被忽略）。
 */

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const s = src.replace(/,/g, "").replace(/×/g, "*").replace(/÷/g, "/").replace(/－/g, "-").replace(/＋/g, "+");
  while (i < s.length) {
    const ch = s[i];
    if (ch === " ") {
      i++;
      continue;
    }
    if ("+-*/()".includes(ch)) {
      tokens.push({ t: ch });
      i++;
      continue;
    }
    const m = /^\d*\.?\d+/.exec(s.slice(i));
    if (!m) return null; // 出現看不懂的字元
    tokens.push({ t: "num", v: parseFloat(m[0]) });
    i += m[0].length;
  }
  return tokens;
}

/**
 * 遞迴下降：expr = term (('+'|'-') term)* ，term = factor (('*'|'/') factor)*
 * factor = number | '(' expr ')' | '-' factor
 */
function parse(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];

  function factor() {
    const tk = peek();
    if (!tk) return null;
    if (tk.t === "-") {
      pos++;
      const v = factor();
      return v === null ? null : -v;
    }
    if (tk.t === "num") {
      pos++;
      return tk.v;
    }
    if (tk.t === "(") {
      pos++;
      const v = expr();
      if (v === null || !peek() || peek().t !== ")") return null;
      pos++;
      return v;
    }
    return null;
  }

  function term() {
    let v = factor();
    if (v === null) return null;
    while (peek() && (peek().t === "*" || peek().t === "/")) {
      const op = peek().t;
      pos++;
      const rhs = factor();
      if (rhs === null) return null;
      if (op === "/" && rhs === 0) return null; // 除以 0 當作還沒寫完
      v = op === "*" ? v * rhs : v / rhs;
    }
    return v;
  }

  function expr() {
    let v = term();
    if (v === null) return null;
    while (peek() && (peek().t === "+" || peek().t === "-")) {
      const op = peek().t;
      pos++;
      const rhs = term();
      if (rhs === null) return null;
      v = op === "+" ? v + rhs : v - rhs;
    }
    return v;
  }

  const result = expr();
  if (result === null || pos !== tokens.length) return null; // 有沒吃完的 token＝式子不完整
  return result;
}

/** 算出結果；算不出來（空的、寫到一半、語法錯）回傳 null。 */
export function evalAmount(src) {
  if (typeof src !== "string" || !src.trim()) return null;
  const tokens = tokenize(src);
  if (!tokens || tokens.length === 0) return null;
  const v = parse(tokens);
  if (v === null || !Number.isFinite(v)) return null;
  // 浮點誤差修一下，1.1+2.2 不要變成 3.3000000000000003
  return Math.round(v * 1e6) / 1e6;
}

/** 這串輸入是不是一條算式（而不是單純一個數字）。 */
export function isExpression(src) {
  return typeof src === "string" && /[+\-*/()×÷－＋]/.test(src.replace(/^\s*-/, ""));
}

/** 加千分位逗號，只處理整數部分，小數與尾隨的小數點保留。 */
export function groupDigits(src) {
  if (typeof src !== "string" || src === "") return "";
  const neg = src.startsWith("-");
  const body = neg ? src.slice(1) : src;
  if (!/^\d*\.?\d*$/.test(body)) return src; // 是算式就別動它
  const [intPart, decPart] = body.split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const out = decPart !== undefined ? `${grouped}.${decPart}` : grouped;
  return (neg ? "-" : "") + out;
}
