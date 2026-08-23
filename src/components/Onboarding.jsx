import React, { useState } from "react";
import { findMemberByName } from "../lib/format.js";

/**
 * onPick(memberId, newName, options)
 *  - 選現有成員：onPick(id)
 *  - 新增成員：onPick(null, "名字")
 *  - 復原被刪除的同名成員：onPick(id, null, { revive: true })
 */
export function Onboarding({ group, onPick, onBack }) {
  const [newName, setNewName] = useState("");
  const activeMembers = group.members.filter((m) => !m.deleted);
  const trimmed = newName.trim();
  const match = trimmed ? findMemberByName(group.members, trimmed) : null;
  const clashesWithActive = match && !match.deleted;
  const canRevive = match && match.deleted;

  return (
    <div className="screen">
      <div className="topbar" style={{ marginBottom: 0 }}>
        <button className="backbtn" onClick={onBack} aria-label="返回">‹</button>
      </div>
      <div className="onboard-hero">
        <div className="onboard-eyebrow">加入群組</div>
        <div className="onboard-title">{group.name}</div>
        <div className="onboard-desc">先告訴我們你是誰，這台裝置會記住你</div>
      </div>
      <div className="section-label">我是已知成員</div>
      <div className="member-pick-grid">
        {activeMembers.map((m) => (
          <button key={m.id} className="member-pick" onClick={() => onPick(m.id)}>
            {m.name}
          </button>
        ))}
      </div>
      {activeMembers.length === 0 && <div className="empty-hint">這個群組還沒有成員</div>}

      <div className="section-label" style={{ marginTop: 20 }}>還不在名單上？</div>
      <div className="row-form">
        <input
          className="input"
          placeholder="輸入你的名字"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          className="btn-accent"
          disabled={!trimmed || !!match}
          onClick={() => onPick(null, trimmed)}
        >
          加入
        </button>
      </div>
      {clashesWithActive && <div className="hint-text hint-warn">名單上已經有「{trimmed}」了，請直接從上面選他。</div>}
      {canRevive && (
        <div className="card subtle" style={{ marginTop: 8 }}>
          <div className="hint-text">
            「{trimmed}」之前被刪除過。復原之後他過去的紀錄會重新接回同一個人。
          </div>
          <button
            className="btn-accent full-width"
            style={{ marginTop: 10 }}
            onClick={() => onPick(match.id, null, { revive: true })}
          >
            復原「{trimmed}」並用這個身分
          </button>
        </div>
      )}
    </div>
  );
}
