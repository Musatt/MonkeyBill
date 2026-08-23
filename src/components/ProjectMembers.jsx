import React from "react";

export function ProjectMembers({ group, project, onToggle }) {
  const activeMembers = group.members.filter((m) => !m.deleted);
  return (
    <div className="screen">
      <div className="hint-text" style={{ marginBottom: 12 }}>
        新加入的人不會被算進「之前」已存在的均分項目裡，只會影響之後新增的項目。
      </div>
      <div className="list-stack">
        {activeMembers.map((m) => {
          const on = project.memberIds.includes(m.id);
          return (
            <button key={m.id} className={"toggle-row" + (on ? " toggle-row-on" : "")} onClick={() => onToggle(m.id, !on)}>
              <span>{m.name}</span>
              <span className={"mini-check" + (on ? " on" : "")}>{on ? "✓" : ""}</span>
            </button>
          );
        })}
        {activeMembers.length === 0 && <div className="empty-hint">這個群組還沒有成員</div>}
      </div>
    </div>
  );
}
