import React, { useState, useMemo } from "react";
import { hashPassword } from "../lib/auth.js";
import { hasRecordsInGroup } from "../lib/schema.js";
import { nameError, normalizeName } from "../lib/names.js";
import { isVirtual, canJoinGroup, canDeleteVirtualMember } from "../lib/permissions.js";
import { TopBar } from "./primitives.jsx";

/**
 * 群組成員管理（管理者才進得來）。
 *
 * 這裡有兩種成員：
 * ・正式成員 —— 全域帳號，跨群組共用，可以自己登入。
 * ・虛擬成員 —— 只存在於這個群組、不能登入。用在「要幫他記帳但他不會用這個網站」，
 *   或是「這個群組不想被別人看到」的時候。需要的時候可以轉成正式成員。
 *
 * 帳號是全域的，所以這裡只管「誰在這個群組」與「誰是管理者」，不刪帳號本身。
 * 有留下紀錄的人不能移出（歷史帳目會找不到人），只能停用。
 */
export function GroupMembersScreen({ group, data, myId, backstage, onBack, actions }) {
  const [adding, setAdding] = useState(null); // null | 'real' | 'virtual'
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [promoting, setPromoting] = useState(null); // 要轉成正式成員的虛擬成員
  const [promotePw, setPromotePw] = useState("");

  const inactive = new Set(group.inactiveMemberIds || []);
  const admins = new Set(group.adminIds || []);

  const members = useMemo(
    () => group.memberIds.map((id) => data.users[id]).filter(Boolean),
    [group.memberIds, data.users]
  );
  const activeMembers = members.filter((u) => !inactive.has(u.id));
  const inactiveMembers = members.filter((u) => inactive.has(u.id));

  // 還沒加進這個群組、也沒被後臺停用的帳號。
  // 別的群組的虛擬成員不能選——虛擬成員只屬於建立他的那個群組。
  const candidates = useMemo(
    () =>
      Object.values(data.users)
        .filter((u) => !u.disabled && !group.memberIds.includes(u.id) && canJoinGroup(u, group.id))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
    [data.users, group.memberIds, group.id]
  );

  const lockedIds = useMemo(() => {
    const s = new Set();
    group.memberIds.forEach((id) => {
      if (hasRecordsInGroup(data, group.id, id)) s.add(id);
    });
    return s;
  }, [data, group.id, group.memberIds]);

  const addError = newName ? nameError(newName, data.users) : "";
  const canCreate = !!normalizeName(newName) && !addError && !busy;

  const createMember = async () => {
    setBusy(true);
    try {
      const name = normalizeName(newName);
      if (adding === "virtual") {
        actions.createVirtualMember(group.id, name);
      } else {
        const passwordHash = newPw ? await hashPassword(newPw) : null;
        actions.createUserInGroup(group.id, name, passwordHash);
      }
      closeAdd();
    } finally {
      setBusy(false);
    }
  };

  const closeAdd = () => {
    setAdding(null);
    setNewName("");
    setNewPw("");
  };

  const doPromote = async () => {
    setBusy(true);
    try {
      const passwordHash = promotePw ? await hashPassword(promotePw) : null;
      actions.promoteToReal(promoting.id, passwordHash);
      setPromoting(null);
      setPromotePw("");
    } finally {
      setBusy(false);
    }
  };

  const adminCount = (group.adminIds || []).length;

  /*
    操作鍵用顏色分成三類，一整排同色會分不出哪個是哪個：
      綠 = 給他東西（設為管理者、啟用、轉成正式）
      黃 = 收回（取消管理者、停用）
      紅 = 拿掉這個人（移出、刪除）
  */
  const row = (u) => {
    const isAdmin = admins.has(u.id);
    const isInactive = inactive.has(u.id);
    const locked = lockedIds.has(u.id);
    const lastAdmin = isAdmin && adminCount <= 1;
    const virtual = isVirtual(u);
    const canDelete = canDeleteVirtualMember(u, myId, group, backstage, locked);
    return (
      <div key={u.id} className={"member-order-row" + (isInactive ? " member-order-row-off" : "")}>
        <span className="member-order-name">
          {u.name}
          {u.id === myId && <span className="row-me-tag">你</span>}
          {virtual && <span className="virtual-tag">虛擬</span>}
          {isAdmin && <span className="admin-tag">管理者</span>}
          {isInactive && <span className="off-tag">已停用</span>}
        </span>
        {virtual ? (
          // 虛擬成員不能登入，所以「管理者」對他沒有意義
          <button className="rowact rowact-grant" onClick={() => setPromoting(u)}>轉成正式</button>
        ) : (
          <button
            className={"rowact " + (isAdmin ? "rowact-revoke" : "rowact-grant")}
            onClick={() => actions.setGroupAdmin(group.id, u.id, !isAdmin)}
            disabled={lastAdmin}
            title={lastAdmin ? "群組至少要留一位管理者" : undefined}
          >
            {isAdmin ? "取消管理者" : "設為管理者"}
          </button>
        )}
        <button
          className={"rowact " + (isInactive ? "rowact-grant" : "rowact-revoke")}
          onClick={() => actions.setMemberInactive(group.id, u.id, !isInactive)}
        >
          {isInactive ? "啟用" : "停用"}
        </button>
        {virtual
          ? canDelete && (
              <button className="rowact rowact-danger" onClick={() => setConfirmRemove(u)}>刪除</button>
            )
          : !locked && (
              <button className="rowact rowact-danger" onClick={() => setConfirmRemove(u)}>移出</button>
            )}
      </div>
    );
  };

  return (
    <div className="screen">
      <TopBar title="管理成員" subtitle={group.name} onBack={onBack} />

      <div className="hint-text">
        帳號是跨群組共用的，這裡只調整「誰在這個群組」。有留下帳目的人不能移出，只能停用——
        停用後不會出現在新增項目的選人清單，但歷史紀錄與餘額都保留。
      </div>

      <div className="sec-head">
        成員 <span className="sec-head-n">{activeMembers.length}</span>
      </div>
      <div className="member-order-list">
        {activeMembers.map(row)}
        {activeMembers.length === 0 && <div className="empty-hint">這個群組還沒有成員</div>}
      </div>

      {inactiveMembers.length > 0 && (
        <>
          <div className="sec-head">
            已停用 <span className="sec-head-n">{inactiveMembers.length}</span>
          </div>
          <div className="member-order-list">{inactiveMembers.map(row)}</div>
        </>
      )}

      <div className="sec-head">加入成員</div>
      {candidates.length > 0 && (
        <>
          <div className="hint-text">從現有帳號選：</div>
          <div className="member-chip-row" style={{ marginTop: 6 }}>
            {candidates.map((u) => (
              <button key={u.id} className="member-tag selectable" onClick={() => actions.addMemberToGroup(group.id, u.id)}>
                ＋ {u.name}
              </button>
            ))}
          </div>
        </>
      )}

      {!adding ? (
        <div className="row-form" style={{ marginTop: 12 }}>
          <button className="btn-outline" onClick={() => setAdding("real")}>＋ 正式成員</button>
          <button className="btn-outline" onClick={() => setAdding("virtual")}>＋ 虛擬成員</button>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="sec-head sec-head-tight">
            {adding === "virtual" ? "建立虛擬成員" : "建立正式成員"}
          </div>
          <div className="hint-text">
            {adding === "virtual"
              ? "虛擬成員不會出現在登入畫面，別人選不到他，也就進不來這個群組。他只屬於這個群組，之後隨時可以轉成正式成員。"
              : "正式成員是全域帳號，可以自己登入，也能被加進別的群組。"}
          </div>

          <label className="form-label">暱稱</label>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：正傑" autoFocus />
          {addError && <div className="hint-text hint-warn">{addError}</div>}
          <div className="hint-text">暱稱全系統唯一，正式成員與虛擬成員都不能重複。</div>

          {adding === "real" && (
            <>
              <label className="form-label">密碼（可留空）</label>
              <input
                className="input mono"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="通常留空，讓本人之後自己設"
              />
              <div className="hint-text">幫朋友建的帳號建議留空密碼，他自己登入後再去個人資料設定。</div>
            </>
          )}

          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={closeAdd}>取消</button>
            <button className="btn-accent" disabled={!canCreate} onClick={createMember}>
              {busy ? "建立中…" : "建立並加入"}
            </button>
          </div>
        </div>
      )}

      {promoting && (
        <div className="modal-backdrop" onClick={() => setPromoting(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">轉成正式成員</div>
            <div className="modal-title">{promoting.name}</div>
            <div className="hint-text">
              轉成正式成員之後，他就會出現在登入畫面、可以自己進來，也能被加進別的群組。
              所有歷史帳目完全不動。
            </div>
            <label className="form-label">密碼（可留空）</label>
            <input
              className="input mono"
              type="password"
              value={promotePw}
              onChange={(e) => setPromotePw(e.target.value)}
              placeholder="留空的話任何人都能選他的身分"
            />
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => { setPromoting(null); setPromotePw(""); }}>取消</button>
              <button className="btn-accent" disabled={busy} onClick={doPromote}>
                {busy ? "轉換中…" : "確定轉換"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="modal-backdrop" onClick={() => setConfirmRemove(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">
              {isVirtual(confirmRemove) ? "刪除虛擬成員" : "移出群組"}
            </div>
            <div className="modal-title">{confirmRemove.name}</div>
            <div className={"hint-text" + (isVirtual(confirmRemove) ? " hint-warn" : "")}>
              {isVirtual(confirmRemove)
                ? "他在這個群組沒有任何帳目紀錄，可以直接刪掉。虛擬成員只存在於這個群組，刪除後就完全消失，無法復原——需要的話要重新建一個。"
                : "他在這個群組沒有任何帳目紀錄，移出不會影響歷史。帳號本身不會被刪除，之後還能再加回來。"}
            </div>
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setConfirmRemove(null)}>取消</button>
              <button
                className="btn-accent"
                onClick={() => {
                  if (isVirtual(confirmRemove)) actions.deleteVirtualMember(group.id, confirmRemove.id);
                  else actions.removeMemberFromGroup(group.id, confirmRemove.id);
                  setConfirmRemove(null);
                }}
              >
                {isVirtual(confirmRemove) ? "確定刪除" : "確定移出"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
