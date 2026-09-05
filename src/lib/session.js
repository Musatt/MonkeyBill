/* 這台裝置目前登入的身分。換裝置就要重新選一次。 */

const KEY = "monkeybill.session";

export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    if (!v || typeof v !== "object") return { userId: null, backstage: false };
    return { userId: v.userId || null, backstage: !!v.backstage };
  } catch {
    return { userId: null, backstage: false };
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // 無痕模式寫不進去就算了，只是下次要重選身分
  }
}
