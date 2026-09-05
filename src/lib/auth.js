/**
 * 身分密碼。
 *
 * 存的是 SHA-256 雜湊而不是明文——資料庫是公開可讀的，明文密碼等於直接貼在網路上。
 * 雜湊過至少別人撈到也還原不出原始密碼。
 *
 * 但要說清楚：驗證是在瀏覽器端做的，這擋的是「手滑點到別人的身分」，
 * 不是真正的存取控制。有心人改一下前端就能繞過。
 */

export async function hashPassword(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyPassword(password, hash) {
  if (!hash) return true; // 沒設密碼的帳號直接放行
  return (await hashPassword(password)) === hash;
}

export function hasPassword(user) {
  return !!(user && user.passwordHash);
}
