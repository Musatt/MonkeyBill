/* 存在這台裝置上的偏好：你在各群組是誰、解鎖過哪些群組。 */

const IDENTITY_KEY = "monkeybill.identity";
const UNLOCKED_KEY = "monkeybill.unlocked";

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 無痕模式或容量滿了就算了，不影響主要功能
  }
}

export function loadIdentity() {
  const v = read(IDENTITY_KEY, {});
  return v && typeof v === "object" ? v : {};
}

export function saveIdentity(identity) {
  write(IDENTITY_KEY, identity);
}

export function loadUnlocked() {
  const v = read(UNLOCKED_KEY, []);
  return new Set(Array.isArray(v) ? v : []);
}

export function saveUnlocked(set) {
  write(UNLOCKED_KEY, Array.from(set));
}
