import React, { useState, useEffect } from "react";
import { todayStr, nowHHMM, relativeTime } from "../lib/format.js";
import { isPickable } from "../lib/permissions.js";
import { memberIdsUsedByExpense } from "../lib/schema.js";
import { exportCSV } from "../lib/exportCsv.js";
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
  users,
  project,
  expenses,
  membersById,
  myId,
  perms,
  lastSyncedAt,
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  // 「已付款」帶進表單的預填內容，無法用網址表達，所以放在元件狀態裡
  const [prefill, setPrefill] = useState(null);
  const [, forceTick] = useState(0);

  // 讓「N 秒前同步」自己會走
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, editor?.mode, editor?.expenseId]);

  useEffect(() => {
    if (!editor) setPrefill(null);
  }, [editor]);

  const handleRefresh = async () => {
    setSyncing(true);
    setMenuOpen(false);
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
      if (!exp) editorProps = { missing: true };
      else if (editor.mode === "edit") editorProps = { isEdit: true, initialValues: exp };
      else {
        const n = nowHHMM();
        editorProps = { isEdit: false, initialValues: { ...exp, date: todayStr(), time: `${n.hour}:${n.minute}` } };
      }
    }
  }

  // 表單的選人名單：目前可選的人，加上這筆項目原本就用到的人
  const formMemberIds = (() => {
    const base = project.memberIds.filter((id) => isPickable(users[id], group));
    const item = editorProps && editorProps.initialValues ? memberIdsUsedByExpense(editorProps.initialValues) : [];
    const extra = item.filter((id) => project.memberIds.includes(id) && !base.includes(id));
    return project.memberIds.filter((id) => base.includes(id) || extra.includes(id));
  })();

  const doExport = () => {
    setMenuOpen(false);
    setToast(exportCSV(project, expenses, membersById) ? "已匯出 CSV" : "匯出失敗，可能被瀏覽器擋下");
    setTimeout(() => setToast(""), 2600);
  };

  return (
    <div>
      <div className="hdr">
        <button className="icon-btn backbtn" onClick={editor ? onCloseEditor : onBack} aria-label="返回">‹</button>
        <div className="hdr-text">
          <div className="hdr-name">{project.name}</div>
          <div className="hdr-sub">
            {group.name} · 你是 {membersById[myId]?.name || "?"} ·{" "}
            {syncing ? "同步中…" : relativeTime(lastSyncedAt)}
          </div>
        </div>
        {!editor && (
          <div className="menu-wrap">
            <button className="icon-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="更多" aria-expanded={menuOpen}>
              ⋯
            </button>
            {menuOpen && (
              <>
                <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
                <div className="menu-pop" role="menu">
                  <button onClick={handleRefresh}>立即同步</button>
                  <button onClick={() => { setMenuOpen(false); onShare(); }}>分享專案</button>
                  <button onClick={doExport}>匯出 CSV</button>
                  <button onClick={() => { setMenuOpen(false); onOpenSettings(); }}>編輯專案</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}

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
          <div className="tabbar tabbar-sticky">
            {TABS.map(([id, label]) => (
              <button key={id} className={"tab" + (tab === id ? " tab-on" : "")} onClick={() => onTabChange(id)}>
                {label}
              </button>
            ))}
          </div>

          {tab === "expenses" && (
            <>
              <ExpenseList
                project={project}
                expenses={expenses}
                membersById={membersById}
                myId={myId}
                canDelete={perms.canDeleteExpenseById}
                onEdit={(id) => onOpenEditor("edit", id)}
                onDelete={actions.deleteExpense}
              />
              <button className="fab" onClick={() => onOpenEditor("new")} aria-label="新增項目">＋</button>
            </>
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
