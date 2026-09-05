import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hash 路由。用 hash 而不是 History API，是因為 GitHub Pages 是靜態主機，
 * 深層路徑（/MonkeyBill/g/xxx）重新整理會 404，hash 則完全不用伺服器設定。
 *
 * #/                          首頁
 * #/g/:gid                    群組
 * #/g/:gid/m/:mid             成員詳情
 * #/g/:gid/p/:pid             專案（預設項目分頁）
 * #/g/:gid/p/:pid/t/:tab      專案指定分頁 expenses|settlement|stats|members
 * #/g/:gid/p/:pid/new         新增項目
 * #/g/:gid/p/:pid/edit/:eid   編輯項目
 * #/g/:gid/p/:pid/copy/:eid   複製項目
 */

export const PROJECT_TABS = ["expenses", "settlement", "stats", "members"];

export function parseHash(hash) {
  const raw = (hash || "").replace(/^#/, "");
  const parts = raw.split("/").filter(Boolean).map(decodeURIComponent);
  const home = {
    screen: "home",
    groupId: null,
    projectId: null,
    userId: null,
    tab: "expenses",
    editor: null,
    settings: false,
    members: false,
  };
  if (parts[0] === "u" && parts[1]) return { ...home, screen: "user", userId: parts[1] };
  if (parts.length === 0 || parts[0] !== "g" || !parts[1]) return home;

  const groupId = parts[1];
  if (parts.length === 2) return { ...home, screen: "group", groupId };

  if (parts[2] === "settings") return { ...home, screen: "group", groupId, settings: true };
  if (parts[2] === "members") return { ...home, screen: "group", groupId, members: true };
  if (parts[2] === "u" && parts[3]) return { ...home, screen: "user", groupId, userId: parts[3] };
  if (parts[2] === "p" && parts[3]) {
    const projectId = parts[3];
    const base = { ...home, screen: "project", groupId, projectId };
    if (parts.length === 4) return base;
    if (parts[4] === "settings") return { ...base, settings: true };
    if (parts[4] === "t" && PROJECT_TABS.includes(parts[5])) return { ...base, tab: parts[5] };
    if (parts[4] === "new") return { ...base, editor: { mode: "new" } };
    if (parts[4] === "edit" && parts[5]) return { ...base, editor: { mode: "edit", expenseId: parts[5] } };
    if (parts[4] === "copy" && parts[5]) return { ...base, editor: { mode: "copy", expenseId: parts[5] } };
    return base;
  }
  return { ...home, screen: "group", groupId };
}

export function buildHash(route) {
  const enc = encodeURIComponent;
  if (route && route.screen === "user" && route.userId) {
    return route.groupId ? `#/g/${enc(route.groupId)}/u/${enc(route.userId)}` : `#/u/${enc(route.userId)}`;
  }
  if (!route || route.screen === "home" || !route.groupId) return "#/";
  if (route.screen === "group") {
    if (route.settings) return `#/g/${enc(route.groupId)}/settings`;
    if (route.members) return `#/g/${enc(route.groupId)}/members`;
    return `#/g/${enc(route.groupId)}`;
  }

  if (route.screen === "project") {
    const base = `#/g/${enc(route.groupId)}/p/${enc(route.projectId)}`;
    if (route.settings) return `${base}/settings`;
    if (route.editor?.mode === "new") return `${base}/new`;
    if (route.editor?.mode === "edit") return `${base}/edit/${enc(route.editor.expenseId)}`;
    if (route.editor?.mode === "copy") return `${base}/copy/${enc(route.editor.expenseId)}`;
    return route.tab && route.tab !== "expenses" ? `${base}/t/${route.tab}` : base;
  }
  return "#/";
}

/**
 * 這個畫面的「上一階」是哪裡。跟瀏覽器的「上一頁」是兩回事：
 * 上一頁看的是你走過的路徑（刪掉一筆項目後上一頁可能是結算頁），
 * 上一階看的是畫面的層級（項目 → 專案 → 群組 → 首頁），永遠可預期。
 */
export function parentOf(route) {
  if (!route || route.screen === "home") return null;
  // 從群組點進來的個人資料，上一階是那個群組；從首頁點自己的，上一階才是首頁
  if (route.screen === "user") return route.groupId ? { screen: "group", groupId: route.groupId } : { screen: "home" };
  if (!route.groupId) return null;
  const { groupId, projectId } = route;
  if (route.screen === "group") return route.settings || route.members ? { screen: "group", groupId } : { screen: "home" };
  if (route.screen === "project") {
    if (route.settings || route.editor) return { screen: "project", groupId, projectId, tab: route.tab };
    return { screen: "group", groupId };
  }
  return { screen: "home" };
}

/** 從首頁到目前畫面的完整層級鏈，用來替深連結補上歷史紀錄。 */
function ancestorChain(route) {
  const chain = [];
  let cur = parentOf(route);
  while (cur) {
    chain.unshift(cur);
    cur = parentOf(cur);
  }
  return chain;
}

export function useRouter() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  const currentHashRef = useRef(window.location.hash);
  const prevHashRef = useRef(null);

  useEffect(() => {
    const onChange = () => {
      prevHashRef.current = currentHashRef.current;
      currentHashRef.current = window.location.hash;
      setRoute(parseHash(window.location.hash));
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // 從分享連結直接進來時，上面沒有任何歷史紀錄，按上一頁完全沒反應。
  // 這裡把「首頁 → 群組 → 專案」這條鏈補進歷史，上一頁才能一路退回首頁。
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return; // StrictMode 會跑兩次 effect，只補一次
    seededRef.current = true;
    const initial = parseHash(window.location.hash);
    const chain = ancestorChain(initial);
    if (chain.length === 0) return;
    const target = buildHash(initial);
    window.history.replaceState(null, "", buildHash(chain[0]));
    for (let i = 1; i < chain.length; i++) window.history.pushState(null, "", buildHash(chain[i]));
    window.history.pushState(null, "", target);
    // pushState/replaceState 不會觸發 hashchange，網址列最後停在原本那一頁，畫面不受影響
    prevHashRef.current = buildHash(chain[chain.length - 1]);
    currentHashRef.current = target;
  }, []);

  // 推進一個新的歷史紀錄，手機返回鍵才會回到上一層而不是直接關掉 App
  const navigate = useCallback((next) => {
    const hash = buildHash(next);
    if (hash === window.location.hash || (hash === "#/" && window.location.hash === "")) {
      setRoute(parseHash(hash));
      return;
    }
    window.location.hash = hash;
  }, []);

  // 不留歷史紀錄的切換（例如分頁切換不希望塞爆返回鍵）
  const replace = useCallback((next) => {
    const hash = buildHash(next);
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(null, "", url);
    currentHashRef.current = hash; // replaceState 不會觸發 hashchange，refs 要自己維護
    setRoute(parseHash(hash));
  }, []);

  const back = useCallback(() => window.history.back(), []);

  /**
   * 回上一階。畫面上的 ‹ 一律走這裡，結果永遠可預期。
   * 如果瀏覽器的上一頁剛好就是要回去的那一階，就用 back，
   * 免得歷史紀錄一路往前長（按 ‹ 離開又按上一頁回來會很怪）。
   */
  const up = useCallback(
    (from) => {
      const target = parentOf(from);
      if (!target) return;
      const targetHash = buildHash(target);
      if (prevHashRef.current === targetHash) {
        window.history.back();
        return;
      }
      const hash = targetHash;
      if (hash === window.location.hash) {
        setRoute(parseHash(hash));
        return;
      }
      window.location.hash = hash;
    },
    []
  );

  return { route, navigate, replace, back, up };
}
