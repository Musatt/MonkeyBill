import { useEffect, useState } from "react";

/**
 * 手機上「正在打字（鍵盤開著）」的時候回傳 true。
 *
 * 用途：表單底部固定的「取消／新增項目」列，平常黏在畫面底部很方便，
 * 但鍵盤一跳出來，那一列會被推到鍵盤正上方，把本來就很小的可視範圍再吃掉一塊。
 * 打字時讓它放回表單最後面，打完字才又黏回底部。
 *
 * 只在觸控裝置生效：電腦沒有螢幕鍵盤，按鈕黏在底部不會擋到東西。
 *
 * 判斷方式是「焦點在不在可以打字的欄位上」，不是去量鍵盤高度——
 * 各家手機瀏覽器回報的畫面高度不一致，量高度很容易誤判。
 * 下拉選單也算，iPhone 點下拉選單會從底部跳出滾輪，一樣會擋住。
 */
const TYPING_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const NON_TYPING_INPUTS = new Set(["button", "checkbox", "radio", "submit", "reset", "file", "range", "color"]);

function isTypingTarget(el) {
  if (!el || !TYPING_TAGS.has(el.tagName)) return false;
  if (el.tagName === "INPUT" && NON_TYPING_INPUTS.has((el.type || "").toLowerCase())) return false;
  return !el.readOnly && !el.disabled;
}

export function useTypingOnTouch() {
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const coarse = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return undefined;

    let timer = null;
    const check = () => {
      clearTimeout(timer);
      // 從一個欄位跳到下一個欄位時，會先離開再進入。
      // 等一下再看焦點落在哪，免得中間那一瞬間按鈕列閃出來又收回去。
      timer = setTimeout(() => setTyping(isTypingTarget(document.activeElement)), 60);
    };
    document.addEventListener("focusin", check);
    document.addEventListener("focusout", check);
    check();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusin", check);
      document.removeEventListener("focusout", check);
    };
  }, []);

  return typing;
}
