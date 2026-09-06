/**
 * 誰可以做什麼。
 *
 * 一般成員：新增項目、編輯任何人的項目、只能刪自己建立的項目、改專案設定、建立專案。
 * 管理者　：以上全部，加上刪除群組／專案／任何項目、管理群組成員與管理者。
 * 後臺管理：等同所有群組的管理者。
 */

/**
 * 虛擬成員：只存在於某一個群組裡、不能登入的人。
 *
 * 為什麼需要：沒設密碼的身分，任何打開網站的人都能在登入頁選走。
 * 如果一個私密群組裡放了幾個「只是要記帳、本人根本不會用這個網站」的人，
 * 那些身分就變成別人進來看這個群組的門。虛擬成員從登入頁整個消失，堵住這個洞。
 *
 * 實作上它仍然是一筆 users 記錄，只是多了 virtual 旗標——
 * 因為所有帳目都用 user id 指向人（付款人、分攤、轉帳、結算、統計），
 * 另外開一張表會讓每一處都要多判斷一次。
 */
export function isVirtual(user) {
  return !!(user && user.virtual);
}

/** 能不能出現在登入頁被選。虛擬成員永遠不行，這是它存在的意義。 */
export function canLogin(user) {
  return !!user && !user.disabled && !isVirtual(user);
}

/** 虛擬成員只屬於自己那個群組，別的群組不能把他加進來。 */
export function canJoinGroup(user, groupId) {
  if (!isVirtual(user)) return true;
  return user.ownerGroupId === groupId;
}

/**
 * 誰能改這個人的暱稱與密碼。
 * 一般帳號只有本人；虛擬成員沒有「本人」，由所屬群組的管理者代管。
 */
export function canEditIdentity(user, viewerId, group, backstage) {
  if (backstage) return true;
  if (isVirtual(user)) return isGroupAdmin(group, viewerId, false);
  return !!user && user.id === viewerId;
}

/** 把虛擬成員轉成正式帳號：所屬群組的管理者就可以做，反正本來就是他建的。 */
export function canPromoteToReal(user, viewerId, group, backstage) {
  if (!isVirtual(user)) return false;
  if (backstage) return true;
  return !!group && group.id === user.ownerGroupId && isGroupAdmin(group, viewerId, false);
}

export function isGroupMember(group, userId) {
  return !!group && !!userId && group.memberIds.includes(userId);
}

export function isGroupAdmin(group, userId, backstage) {
  if (backstage) return true;
  return !!group && !!userId && (group.adminIds || []).includes(userId);
}

export function canDeleteGroup(group, userId, backstage) {
  return isGroupAdmin(group, userId, backstage);
}

export function canDeleteProject(group, userId, backstage) {
  return isGroupAdmin(group, userId, backstage);
}

export function canManageMembers(group, userId, backstage) {
  return isGroupAdmin(group, userId, backstage);
}

export function canEditGroupInfo(group, userId, backstage) {
  return isGroupAdmin(group, userId, backstage);
}

/** 專案設定（名稱、日期、結算位數）群組成員都能改，只有刪除要管理者。 */
export function canEditProject(group, userId, backstage) {
  return backstage || isGroupMember(group, userId);
}

export function canAddExpense(group, userId, backstage) {
  return backstage || isGroupMember(group, userId);
}

/** 記錯帳很常見，所以編輯開放給群組成員。 */
export function canEditExpense(group, userId, backstage) {
  return backstage || isGroupMember(group, userId);
}

/** 只能刪自己建立的，避免誤刪別人的帳；管理者不受限。 */
export function canDeleteExpense(expense, group, userId, backstage) {
  if (isGroupAdmin(group, userId, backstage)) return true;
  if (!expense || !expense.createdBy) return false; // 沒有擁有者的舊資料只有管理者能刪
  return expense.createdBy === userId;
}

export function deleteExpenseReason(expense, group, userId, backstage) {
  if (canDeleteExpense(expense, group, userId, backstage)) return "";
  if (!expense.createdBy) return "這筆是舊資料，沒有記錄建立者，只有管理者能刪除";
  return "只有建立這筆的人或管理者能刪除";
}

/**
 * 這個人現在能不能被「選」（新增項目的付款人、分攤成員、加入專案…）。
 * 全域停用（後臺）和群組停用（管理者）都會讓人從選單消失，
 * 但歷史紀錄與結算餘額一律照算，不受影響。
 */
export function isPickable(user, group) {
  if (!user || user.disabled) return false;
  if (group && (group.inactiveMemberIds || []).includes(user.id)) return false;
  return true;
}
