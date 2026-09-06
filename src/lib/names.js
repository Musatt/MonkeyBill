/**
 * 暱稱規則。
 *
 * 暱稱是全系統唯一的識別——登入時就是靠它認人，結算表上也是靠它認人。
 * 所以不同群組之間也不能重複，虛擬成員也一起算，
 * 不然一張結算表上出現兩個「阿明」，誰也分不出來誰是誰。
 *
 * 這裡集中一份，是因為「建立身分」「群組建成員」「改名」三個地方
 * 都要用同一套規則；分散寫三份遲早會有一份漏掉。
 */

import { BACKSTAGE_NAME } from "../constants.js";

/** 去掉前後空白，中間連續空白收成一個。 */
export function normalizeName(name) {
  return String(name ?? "").trim().replace(/\s+/g, " ");
}

/** 比對用的鍵。大小寫與空白差異都視為同一個名字，避免出現 abc 與 ABC 兩個人。 */
export function nameKey(name) {
  return normalizeName(name).toLowerCase();
}

/** 這個名字已經被誰用了？沒人用回傳 null。exceptId 是「改名時忽略自己」。 */
export function findNameOwner(users, name, exceptId) {
  const key = nameKey(name);
  if (!key) return null;
  return Object.values(users || {}).find((u) => u.id !== exceptId && nameKey(u.name) === key) || null;
}

/**
 * 檢查一個暱稱能不能用。可以用回傳空字串，不能用回傳要顯示給人看的原因。
 * 不區分被正式成員還是虛擬成員佔用——說得太細等於洩漏別人私密群組裡有誰。
 */
export function nameError(name, users, exceptId) {
  const n = normalizeName(name);
  if (!n) return "請輸入暱稱";
  if (nameKey(n) === nameKey(BACKSTAGE_NAME)) return "這是保留名稱，不能用";
  if (findNameOwner(users, n, exceptId)) return "已經有人用這個暱稱了，請換一個";
  return "";
}
