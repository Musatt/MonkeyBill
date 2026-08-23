import { useState, useEffect, useCallback } from "react";

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
  const home = { screen: "home", groupId: null, projectId: null, memberId: null, tab: "expenses", editor: null };
  if (parts.length === 0 || parts[0] !== "g" || !parts[1]) return home;

  const groupId = parts[1];
  if (parts.length === 2) return { ...home, screen: "group", groupId };

  if (parts[2] === "m" && parts[3]) {
    return { ...home, screen: "member", groupId, memberId: parts[3] };
  }
  if (parts[2] === "p" && parts[3]) {
    const projectId = parts[3];
    const base = { ...home, screen: "project", groupId, projectId };
    if (parts.length === 4) return base;
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
  if (!route || route.screen === "home" || !route.groupId) return "#/";
  if (route.screen === "group") return `#/g/${enc(route.groupId)}`;
  if (route.screen === "member") return `#/g/${enc(route.groupId)}/m/${enc(route.memberId)}`;
  if (route.screen === "project") {
    const base = `#/g/${enc(route.groupId)}/p/${enc(route.projectId)}`;
    if (route.editor?.mode === "new") return `${base}/new`;
    if (route.editor?.mode === "edit") return `${base}/edit/${enc(route.editor.expenseId)}`;
    if (route.editor?.mode === "copy") return `${base}/copy/${enc(route.editor.expenseId)}`;
    return route.tab && route.tab !== "expenses" ? `${base}/t/${route.tab}` : base;
  }
  return "#/";
}

export function useRouter() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
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
    setRoute(parseHash(hash));
  }, []);

  const back = useCallback(() => window.history.back(), []);

  return { route, navigate, replace, back };
}
