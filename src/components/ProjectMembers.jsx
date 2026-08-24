import React from "react";

/**
 * 專案成員頁。
 * project.memberIds 的順序就是這個專案的成員順序，新增項目時的付款人、
 * 分攤成員都照這個順序排，所以這裡可以自己調整成順手的排列。
 */
export function ProjectMembers({ group, project, onToggle, onMove }) {
  const byId = Object.fromEntries(group.members.map((m) => [m.id, m]));
  const joined = project.memberIds.map((id) => byId[id]).filter((m) => m && !m.deleted);
  const others = group.members.filter((m) => !m.deleted && !project.memberIds.includes(m.id));

  return (
    <div className="screen">
      <div className="section-label">參加成員（{joined.length}）</div>
      <div className="hint-text" style={{ marginBottom: 8 }}>
        用 ↑ ↓ 調整順序，新增項目時選人的順序會跟這裡一樣。
      </div>
      <div className="member-order-list">
        {joined.map((m, i) => (
          <div key={m.id} className="member-order-row">
            <button
              className="mini-check on"
              onClick={() => onToggle(m.id, false)}
              aria-label={`把 ${m.name} 移出專案`}
            >
              ✓
            </button>
            <span className="member-order-name">{m.name}</span>
            <button
              className="order-btn"
              disabled={i === 0}
              onClick={() => onMove(m.id, -1)}
              aria-label={`${m.name} 往上`}
            >
              ↑
            </button>
            <button
              className="order-btn"
              disabled={i === joined.length - 1}
              onClick={() => onMove(m.id, 1)}
              aria-label={`${m.name} 往下`}
            >
              ↓
            </button>
          </div>
        ))}
        {joined.length === 0 && <div className="empty-hint">這個專案還沒有成員</div>}
      </div>

      {others.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 20 }}>未參加（{others.length}）</div>
          <div className="member-order-list">
            {others.map((m) => (
              <div key={m.id} className="member-order-row member-order-row-off">
                <button className="mini-check" onClick={() => onToggle(m.id, true)} aria-label={`把 ${m.name} 加入專案`} />
                <span className="member-order-name">{m.name}</span>
                <button className="link-btn" onClick={() => onToggle(m.id, true)}>加入</button>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="hint-text" style={{ marginTop: 12 }}>
        新加入的人不會被算進「之前」已存在的均分項目裡，只會影響之後新增的項目。
      </div>
    </div>
  );
}
