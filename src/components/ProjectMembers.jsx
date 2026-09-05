import React, { useRef, useState } from "react";
import { isPickable } from "../lib/permissions.js";

/**
 * 專案成員頁。
 * project.memberIds 的順序就是這個專案的成員順序，新增項目時的付款人、
 * 分攤成員都照這個順序排，所以這裡可以拖成自己順手的排列。
 *
 * 拖曳用 Pointer Events 而不是 HTML5 的 drag-and-drop——後者在觸控裝置上完全沒反應。
 * 拖曳把手上要設 touch-action: none，否則手指一動瀏覽器會先去捲頁面。
 */
export function ProjectMembers({ group, users, project, onToggle, onReorder }) {
  const joined = project.memberIds.map((id) => users[id]).filter(Boolean);
  // 群組裡還沒加進這個專案的人；停用中的不列出來
  const others = group.memberIds
    .filter((id) => !project.memberIds.includes(id))
    .map((id) => users[id])
    .filter((u) => isPickable(u, group));

  const listRef = useRef(null);
  const geomRef = useRef(null);
  const [drag, setDrag] = useState(null); // { index, toIndex, dy }

  const beginDrag = (e, index) => {
    const rows = [...listRef.current.querySelectorAll("[data-row]")];
    const rects = rows.map((r) => r.getBoundingClientRect());
    const gap = rects.length > 1 ? rects[1].top - rects[0].bottom : 0;
    geomRef.current = { rects, gap, startY: e.clientY, index };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 少數瀏覽器不支援，退化成一般的滑鼠拖曳仍可運作
    }
    setDrag({ index, toIndex: index, dy: 0 });
  };

  const moveDrag = (e) => {
    const g = geomRef.current;
    if (!g || !drag) return;
    // 拖到畫面上下緣時自動捲動，人多的時候才搬得動
    const edge = 70;
    if (e.clientY < edge) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - edge) window.scrollBy(0, 12);

    const dy = e.clientY - g.startY;
    const dragged = g.rects[g.index];
    const center = dragged.top + dragged.height / 2 + dy;
    let to = g.index;
    for (let i = 0; i < g.rects.length; i++) {
      const mid = g.rects[i].top + g.rects[i].height / 2;
      if (i < g.index && center < mid) {
        to = i;
        break;
      }
      if (i > g.index && center > mid) to = i;
    }
    setDrag({ index: g.index, toIndex: to, dy });
  };

  const endDrag = () => {
    if (drag && drag.toIndex !== drag.index) {
      const ids = joined.map((m) => m.id);
      const [moved] = ids.splice(drag.index, 1);
      ids.splice(drag.toIndex, 0, moved);
      onReorder(ids);
    }
    geomRef.current = null;
    setDrag(null);
  };

  // 鍵盤也能排序（把手 focus 後按上下鍵），滑鼠不方便時的備援
  const nudge = (index, delta) => {
    const to = index + delta;
    if (to < 0 || to >= joined.length) return;
    const ids = joined.map((m) => m.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(to, 0, moved);
    onReorder(ids);
  };

  // 拖曳中，其他列要讓出位置
  const shiftFor = (i) => {
    if (!drag || !geomRef.current) return 0;
    const { index, toIndex } = drag;
    if (i === index) return null; // 被拖的那一列自己跟著手指走
    const g = geomRef.current;
    const step = g.rects[index].height + g.gap;
    if (index < toIndex && i > index && i <= toIndex) return -step;
    if (index > toIndex && i >= toIndex && i < index) return step;
    return 0;
  };

  return (
    <div className="screen">
      <div className="section-label">參加成員（{joined.length}）</div>
      <div className="hint-text" style={{ marginBottom: 8 }}>
        按住 ⠿ 拖曳可以調整順序，新增項目時選人的順序會跟這裡一樣。
      </div>
      <div className="member-order-list" ref={listRef}>
        {joined.map((m, i) => {
          const isDragging = drag && drag.index === i;
          const shift = shiftFor(i);
          return (
            <div
              key={m.id}
              data-row
              className={"member-order-row" + (isDragging ? " member-order-row-dragging" : "")}
              style={{
                transform: isDragging ? `translateY(${drag.dy}px)` : shift ? `translateY(${shift}px)` : undefined,
                transition: isDragging ? "none" : "transform 140ms ease",
              }}
            >
              <button
                className="drag-handle"
                onPointerDown={(e) => beginDrag(e, i)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={(e) => {
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    nudge(i, -1);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    nudge(i, 1);
                  }
                }}
                aria-label={`拖曳調整 ${m.name} 的順序，目前第 ${i + 1} 位`}
              >
                ⠿
              </button>
              <span className="member-order-name">{m.name}</span>
              <button className="link-btn" onClick={() => onToggle(m.id, false)}>
                移出
              </button>
            </div>
          );
        })}
        {joined.length === 0 && <div className="empty-hint">這個專案還沒有成員</div>}
      </div>

      {others.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 20 }}>未參加（{others.length}）</div>
          <div className="member-order-list">
            {others.map((m) => (
              <div key={m.id} className="member-order-row member-order-row-off">
                <span className="drag-handle drag-handle-empty" aria-hidden="true" />
                <span className="member-order-name">{m.name}</span>
                <button className="link-btn" onClick={() => onToggle(m.id, true)}>
                  加入
                </button>
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
