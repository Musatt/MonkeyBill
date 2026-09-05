import React, { useState, useEffect } from "react";
import { todayStr, nowHHMM } from "../lib/format.js";
import { isPickable } from "../lib/permissions.js";
import { memberIdsUsedByExpense } from "../lib/schema.js";
import { AddExpenseForm } from "./AddExpenseForm.jsx";
import { ExpenseList } from "./ExpenseList.jsx";
import { SettlementPage } from "./SettlementPage.jsx";
import { StatsPage } from "./StatsPage.jsx";
import { ProjectMembers } from "./ProjectMembers.jsx";

const TABS = [
  ["expenses", "項目"],
  ["settlement", "結算"],
  ["stats", "統計"],
  ["members", "成員"],
];

export function ProjectView({
  group,
  project,
  expenses,
  users,
  membersById,
  myId,
  perms,
  onBack,
  tab,
  onTabChange,
  editor,
  onOpenEditor,
  onCloseEditor,
  onOpenSettings,
  onShare,
  actions,
  onRefresh,
}) {
  const [syncing, setSyncing] = useState(false);
  // 「已付款」帶進表單的預填內容，無法用網址表達，所以放在元件狀態裡
  const [prefill, setPrefill] = useState(null);

  // 換頁時回到最上面，否則從清單中段點「編輯」會覺得沒反應
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, editor?.mode, editor?.expenseId]);

  useEffect(() => {
    if (!editor) setPrefill(null);
  }, [editor]);

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const markPaid = (txn) => {
    const n = nowHHMM();
    setPrefill({
      itemType: "transfer",
      amount: txn.amount,
      currency: project.baseCurrency,
      exchangeRate: 1,
      baseAmount: txn.amount,
      fromMemberId: txn.from,
      toMemberId: txn.to,
      note: "結算轉帳",
      date: todayStr(),
      time: `${n.hour}:${n.minute}`,
    });
    onOpenEditor("new");
  };

  /* ---------- 表單的初始值 ---------- */
  let editorProps = null;
  if (editor) {
    if (editor.mode === "new") {
      editorProps = { isEdit: false, initialValues: prefill };
    } else {
      const exp = expenses.find((e) => e.id === editor.expenseId);
      if (!exp) {
        // 網址指到一筆已經被刪掉的項目
        editorProps = { missing: true };
      } else if (editor.mode === "edit") {
        editorProps = { isEdit: true, initialValues: exp };
      } else {
        const n = nowHHMM();
        editorProps = { isEdit: false, initialValues: { ...exp, date: todayStr(), time: `${n.hour}:${n.minute}` } };
      }
    }
  }

  // 表單的選人名單：目前可選的人，加上這筆項目原本就用到的人
  // （編輯舊紀錄時，就算某人已被停用也要留著，否則一存檔就把他弄丟）
  const formMemberIds = (() => {
    const base = project.memberIds.filter((id) => isPickable(users[id], group));
    const item = editorProps && editorProps.initialValues ? memberIdsUsedByExpense(editorProps.initialValues) : [];
    const extra = item.filter((id) => project.memberIds.includes(id) && !base.includes(id));
    return project.memberIds.filter((id) => base.includes(id) || extra.includes(id));
  })();

  return (
    <div>
      <div className="topbar">
        <button className="backbtn" onClick={editor ? onCloseEditor : onBack} aria-label="返回">‹</button>
        <div className="topbar-text">
          <div className="topbar-title">{project.name}</div>
          {project.description && <div className="topbar-sub">{project.description}</div>}
          <div className="topbar-sub">{group.name} · 你是 {membersById[myId]?.name || "?"}</div>
        </div>
      </div>
      {!editor && (
        <div className="topbar-actions">
          <button className="edit-icon-btn" onClick={onShare}>🔗 分享</button>
          <button className="edit-icon-btn" onClick={handleRefresh} disabled={syncing}>
            {syncing ? "同步中…" : "🔄 同步"}
          </button>
          <button className="edit-icon-btn" onClick={onOpenSettings}>編輯</button>
        </div>
      )}

      {editorProps ? (
        editorProps.missing ? (
          <div className="screen">
            <div className="empty-hint">找不到這筆項目，可能已經被刪除了。</div>
            <button className="btn-accent full-width" style={{ marginTop: 12 }} onClick={onCloseEditor}>回到項目列表</button>
          </div>
        ) : (
          <AddExpenseForm
            project={project}
            allMembers={users}
            memberIds={formMemberIds}
            isEdit={editorProps.isEdit}
            initialValues={editorProps.initialValues}
            onSave={(exp) => {
              actions.saveExpense({ ...exp, lastEditedBy: myId, lastEditedAt: Date.now() });
              onCloseEditor();
            }}
            onCancel={onCloseEditor}
          />
        )
      ) : (
        <>
          <div className="tabbar">
            {TABS.map(([id, label]) => (
              <button key={id} className={"tab" + (tab === id ? " tab-on" : "")} onClick={() => onTabChange(id)}>
                {label}
              </button>
            ))}
          </div>
          {tab === "expenses" && (
            <ExpenseList
              project={project}
              expenses={expenses}
              membersById={membersById}
              myId={myId}
              onAdd={() => onOpenEditor("new")}
              onEdit={(id) => onOpenEditor("edit", id)}
              onDuplicate={(id) => onOpenEditor("copy", id)}
              canDelete={perms.canDeleteExpenseById}
              onDelete={actions.deleteExpense}
            />
          )}
          {tab === "settlement" && (
            <SettlementPage
              project={project}
              expenses={expenses}
              membersById={membersById}
              myId={myId}
              onModeChange={actions.setSettlementMode}
              onMarkPaid={markPaid}
            />
          )}
          {tab === "stats" && <StatsPage project={project} expenses={expenses} membersById={membersById} myId={myId} />}
          {tab === "members" && (
            <ProjectMembers
              group={group}
              users={users}
              project={project}
              onToggle={actions.toggleProjectMember}
              onReorder={actions.setProjectMemberOrder}
            />
          )}
        </>
      )}
    </div>
  );
}
