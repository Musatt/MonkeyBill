import React, { useState, useMemo } from "react";
import { memberIdsUsedByExpense, demoteToVirtualCheck } from "../lib/schema.js";
import { isVirtual } from "../lib/permissions.js";
import { hashPassword } from "../lib/auth.js";
import { PinInput } from "./primitives.jsx";

/**
 * 後臺管理。因為一般流程不開放刪帳號，這裡是唯一能停用／刪除帳號的地方，
 * 也能刪掉不要的群組與專案。刪除一律要二次確認。
 *
 * 「正式帳號 → 虛擬成員」也只開放在這裡：這件事會讓一個人再也不能登入，
 * 放在群組管理裡很難界定誰有資格對誰做。
 */
export function BackstageScreen({ data, onExit, actions }) {
  const [tab, setTab] = useState("users");
  const [confirm, setConfirm] = useState(null); // { kind, id, label }
  const [convert, setConvert] = useState(null); // 要轉換身分類型的帳號
  const [convertPw, setConvertPw] = useState("");
  const [busy, setBusy] = useState(false);

  const users = useMemo(
    () => Object.values(data.users).sort((a, b) => a.name.localeCompare(b.name, "zh-Hant")),
    [data.users]
  );

  // 一個帳號只要在任何地方留下紀錄就不能真的刪掉，只能停用
  const usageOf = useMemo(() => {
    const used = new Set();
    Object.values(data.expenses).forEach((e) => memberIdsUsedByExpense(e).forEach((id) => used.add(id)));
    Object.values(data.groups).forEach((g) => g.memberIds.forEach((id) => used.add(id)));
    return used;
  }, [data]);

  const groupsList = Object.values(data.groups);
  const projectsList = Object.values(data.projects);

  const expenseCountOfProject = (pid) => Object.values(data.expenses).filter((e) => e.projectId === pid).length;
  const projectCountOfGroup = (gid) => projectsList.filter((p) => p.groupId === gid).length;

  const askConfirm = (kind, id, label) => setConfirm({ kind, id, label });
  const doConfirm = () => {
    if (!confirm) return;
    if (confirm.kind === "user") actions.deleteUser(confirm.id);
    if (confirm.kind === "group") actions.deleteGroup(confirm.id);
    if (confirm.kind === "project") actions.deleteProject(confirm.id);
    setConfirm(null);
  };

  // 開啟轉換視窗時就先算好能不能轉，理由要直接寫給人看
  const convertCheck = convert && !isVirtual(convert) ? demoteToVirtualCheck(data, convert.id) : null;

  const doConvert = async () => {
    setBusy(true);
    try {
      if (isVirtual(convert)) {
        actions.promoteToReal(convert.id, convertPw ? await hashPassword(convertPw) : null);
      } else if (convertCheck?.ok) {
        actions.demoteToVirtual(convert.id, convertCheck.groupId);
      }
      setConvert(null);
      setConvertPw("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="screen">
      <div className="backstage-banner">後臺管理模式</div>
      <div className="hdr" style={{ marginTop: 10 }}>
        <div className="hdr-text">
          <div className="hdr-name">後臺管理</div>
          <div className="hdr-sub">
            {users.length} 個帳號 · {groupsList.length} 個群組 · {projectsList.length} 個專案 ·{" "}
            {Object.keys(data.expenses).length} 筆項目
          </div>
        </div>
        <button className="edit-icon-btn" onClick={onExit}>離開後臺</button>
      </div>

      <div className="seg" style={{ marginTop: 10 }}>
        <button className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>帳號</button>
        <button className={tab === "groups" ? "on" : ""} onClick={() => setTab("groups")}>群組</button>
        <button className={tab === "projects" ? "on" : ""} onClick={() => setTab("projects")}>專案</button>
      </div>

      {tab === "users" && (
        <>
          <div className="hint-text" style={{ margin: "10px 0 8px" }}>
            有留下紀錄的帳號不能刪除（會讓歷史帳目找不到人），只能停用。停用後不能登入、也不會出現在任何選單。
            「虛擬」是只屬於某個群組、不能登入的成員。
          </div>
          <div className="member-order-list">
            {users.map((u) => {
              const inUse = usageOf.has(u.id);
              const virtual = isVirtual(u);
              return (
                <div key={u.id} className={"member-order-row" + (u.disabled ? " member-order-row-off" : "")}>
                  <span className="member-order-name">
                    {u.name}
                    {virtual && <span className="virtual-tag">虛擬</span>}
                    {u.passwordHash && <span className="lock-mark"> 🔒</span>}
                    {u.disabled && <span className="off-tag">已停用</span>}
                  </span>
                  {/* 綠＝給他東西，黃＝收回，紅＝拿掉這個人。跟群組的管理成員同一套。 */}
                  <button
                    className={"rowact " + (virtual ? "rowact-grant" : "rowact-revoke")}
                    onClick={() => setConvert(u)}
                  >
                    {virtual ? "轉成正式" : "轉成虛擬"}
                  </button>
                  <button
                    className={"rowact " + (u.disabled ? "rowact-grant" : "rowact-revoke")}
                    onClick={() => actions.setUserDisabled(u.id, !u.disabled)}
                  >
                    {u.disabled ? "啟用" : "停用"}
                  </button>
                  {!inUse && (
                    <button className="rowact rowact-danger" onClick={() => askConfirm("user", u.id, u.name)}>
                      刪除
                    </button>
                  )}
                </div>
              );
            })}
            {users.length === 0 && <div className="empty-hint">還沒有任何帳號</div>}
          </div>
        </>
      )}

      {tab === "groups" && (
        <div className="list-stack" style={{ marginTop: 10 }}>
          {groupsList.map((g) => (
            <div key={g.id} className="detail-row">
              <span>
                {g.name}
                <span className="hint-text" style={{ marginLeft: 6 }}>
                  {g.memberIds.length} 人 · {projectCountOfGroup(g.id)} 個專案
                </span>
              </span>
              <button className="rowact rowact-danger" onClick={() => askConfirm("group", g.id, g.name)}>刪除</button>
            </div>
          ))}
          {groupsList.length === 0 && <div className="empty-hint">還沒有任何群組</div>}
        </div>
      )}

      {tab === "projects" && (
        <div className="list-stack" style={{ marginTop: 10 }}>
          {projectsList.map((p) => (
            <div key={p.id} className="detail-row">
              <span>
                {p.name}
                <span className="hint-text" style={{ marginLeft: 6 }}>
                  {data.groups[p.groupId]?.name || "?"} · {expenseCountOfProject(p.id)} 筆
                </span>
              </span>
              <button className="rowact rowact-danger" onClick={() => askConfirm("project", p.id, p.name)}>刪除</button>
            </div>
          ))}
          {projectsList.length === 0 && <div className="empty-hint">還沒有任何專案</div>}
        </div>
      )}

      {convert && (
        <div className="modal-backdrop" onClick={() => setConvert(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">{isVirtual(convert) ? "轉成正式帳號" : "轉成虛擬成員"}</div>
            <div className="modal-title">{convert.name}</div>

            {isVirtual(convert) ? (
              <>
                <div className="hint-text">
                  轉成正式帳號之後他就會出現在登入畫面、可以自己進來，也能被加進別的群組。
                  歷史帳目完全不動。
                </div>
                <label className="form-label">密碼（數字，可留空）</label>
                <PinInput
                  digitsOnly
                  autoComplete="new-password"
                  value={convertPw}
                  onChange={setConvertPw}
                  placeholder="留空的話任何人都能選他的身分"
                />
              </>
            ) : convertCheck?.ok ? (
              <div className="hint-text">
                他會變成「{convertCheck.groupName}」的虛擬成員：從登入畫面消失、不能再自己登入，
                原本設的密碼會被清除。歷史帳目完全不動，之後也可以再轉回來。
              </div>
            ) : (
              <div className="hint-text hint-warn">{convertCheck?.reason}</div>
            )}

            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => { setConvert(null); setConvertPw(""); }}>取消</button>
              <button
                className="btn-accent"
                disabled={busy || (!isVirtual(convert) && !convertCheck?.ok)}
                onClick={doConvert}
              >
                {busy ? "轉換中…" : "確定轉換"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-backdrop" onClick={() => setConfirm(null)} role="dialog" aria-modal="true">
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="onboard-eyebrow">確認刪除</div>
            <div className="modal-title">{confirm.label}</div>
            <div className="hint-text hint-warn">
              {confirm.kind === "group" &&
                `會一併刪除底下 ${projectCountOfGroup(confirm.id)} 個專案與所有項目，無法復原。`}
              {confirm.kind === "project" &&
                `會一併刪除底下 ${expenseCountOfProject(confirm.id)} 筆項目，無法復原。`}
              {confirm.kind === "user" && "這個帳號沒有任何紀錄，可以安全刪除。"}
            </div>
            <div className="row-form" style={{ marginTop: 12 }}>
              <button className="btn-ghost" onClick={() => setConfirm(null)}>取消</button>
              <button className="btn-accent" onClick={doConfirm}>確定刪除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
