import React, { useState, useMemo } from "react";
import { BACKSTAGE_NAME } from "../constants.js";
import { hashPassword } from "../lib/auth.js";
import { hasRecordsInGroup } from "../lib/schema.js";
import { TopBar } from "./primitives.jsx";

/**
 * 群組成員管理（管理者才進得來）。
 * 帳號是全域的，所以這裡只管「誰在這個群組」與「誰是管理者」，不刪帳號本身。
 * 有留下紀錄的人不能移出（歷史帳目會找不到人），只能停用。
 */
export function GroupMembersScreen({ group, data, myId, backstage, onBack, actions }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPw, setNewPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  const inactive = new Set(group.inactiveMemberIds || []);
  const admins = new Set(group.adminIds || []);

  const members = useMemo(
    () => group.memberIds.map((id) => data.users[id]).filter(Boolean),
    [group.memberIds, data.users]
  );
  const activeMembers = members.filter((u) => !inactive.has(u.id));
  const inactiveMembers = members.filter((u) => inactive.has(u.id));

  // 還沒加進這個群組、也沒被後臺停用的帳號
  const candidates = useMemo(
    () =>
      Object.values(data.users)
        .filter((u) => !u.disabled && !group.memberIds.includes(u.id))
        .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
    [data.users, group.memberIds]
  );

  const lockedIds = useMemo(() => {
    const s = new Set();
    group.memberIds.forEach((id) => {
      if (hasRecordsInGroup(data, group.id, id)) s.add(id);
    });
    return s;
  }, [data, group.id, group.memberIds]);

  const trimmed = newName.trim();
  const nameTaken = Object.values(data.users).some((u) => u.name === trimmed);
  const isReserved = trimmed === BACKSTAGE_NAME;
  const canCreate = !!trimmed && !nameTaken && !isReserved && !busy;

  const createMember = async () => {
    setBusy(true);
    try {
      const passwordHash = newPw ? await hashPassword(newPw) : null;
      actions.createUserInGroup(group.id, trimmed, passwordHash);
      setNewName("");
      setNewPw("");
      setAdding(false);
    } finally {
      setBusy(false);
    }
  };

  const adminCount = (group.adminIds || []).length;

  const row = (u) => {
    const isAdmin = admins.has(u.id);
    const isInactive = inactive.has(u.id);
    const locked = lockedIds.has(u.id);
    const lastAdmin = isAdmin && adminCount <= 1;
    return (
      <div key={u.id} className={"member-order-row" + (isInactive ? " member-order-row-off" : "")}>
        <span className="member-order-name">
          {u.name}
          {u.id === myId && <span className="row-me-tag">你</span>}
          {isAdmin && <span className="admin-tag">管理者</span>}
          {isInactive && <span className="hint-text" style={{ marginLeft: 6 }}>（已停用）</span>}
        </span>
        <button className="link-btn" onClick={() => actions.setGroupAdmin(group.id, u.id, !isAdmin)} disabled={lastAdmin}>
          {isAdmin ? "取消管理者" : "設為管理者"}
        </button>
        <button className="link-btn" onClick={() => actions.setMemberInactive(group.id, u.id, !isInactive)}>
          {isInactive ? "啟用" : "停用"}
        </button>
        {!locked && (
          <button className="link-btn del-btn-danger" onClick={() => setConfirmRemove(u)}>
            移出
          </button>
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

      <div className="band" style={{ marginTop: 14 }}><span>成員 <span className="band-n">{activeMembers.length}</span></span></div>
      <div className="member-order-list">
        {activeMembers.map(row)}
        {activeMembers.length === 0 && <div className="empty-hint">這個群組還沒有成員</div>}
      </div>

      {inactiveMembers.length > 0 && (
        <>
          <div className="band" style={{ marginTop: 18 }}><span>已停用 <span className="band-n">{inactiveMembers.length}</span></span></div>
          <div className="member-order-list">{inactiveMembers.map(row)}</div>
        </>
      )}

      <div className="band" style={{ marginTop: 20 }}><span>加入成員</span></div>
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
        <button className="btn-outline full-width" style={{ marginTop: 12 }} onClick={() => setAdding(true)}>
          ＋ 建立新帳號並加入
        </button>
      ) : (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="section-label">暱稱</div>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="例如：正傑" autoFocus />
          {nameTaken && <div className="hint-text hint-warn">已經有人用這個暱稱了</div>}
          {isReserved && <div className="hint-text hint-warn">這是保留名稱，不能用</div>}
          <div className="section-label" style={{ marginTop: 10 }}>密碼（可留空）</div>
          <input className="input mono" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="通常留空，讓本人之後自己設" />
          <div className="hint-text">幫朋友建的帳號建議留空密碼，他自己登入後再去個人資料設定。</div>
          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => { setAdding(false); setNewName(""); setNewPw(""); }}>取消</button>
            <button className="btn-accent" disabled={!canCreate} onClick={createMember}>
              {busy ? "建立中…" : "建立並加入"}
            </button>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="modal-backdrop" onClick={() => setConfirmRemove(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">移出群組</div>
            <div className="modal-title">{confirmRemove.name}</div>
            <div className="hint-text">
              他在這個群組沒有任何帳目紀錄，移出不會影響歷史。帳號本身不會被刪除，之後還能再加回來。
            </div>
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setConfirmRemove(null)}>取消</button>
              <button
                className="btn-accent"
                onClick={() => {
                  actions.removeMemberFromGroup(group.id, confirmRemove.id);
                  setConfirmRemove(null);
                }}
              >
                確定移出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
