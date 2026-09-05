/**
 * 誰可以做什麼。
 *
 * 一般成員：新增項目、編輯任何人的項目、只能刪自己建立的項目、改專案設定、建立專案。
 * 管理者　：以上全部，加上刪除群組／專案／任何項目、管理群組成員與管理者。
 * 後臺管理：等同所有群組的管理者。
 */

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
