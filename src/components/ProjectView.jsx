import React, { useState, useEffect } from "react";
import { MASTER_PASSWORD } from "../constants.js";
import { todayStr, nowHHMM } from "../lib/format.js";
import { DatePickerBox } from "./primitives.jsx";
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
  membersById,
  myId,
  onSwitchIdentity,
  onBack,
  tab,
  onTabChange,
  editor,
  onOpenEditor,
  onCloseEditor,
  actions,
  onRefresh,
  onDeleteProject,
}) {
  const [editingProject, setEditingProject] = useState(false);
  const [pname, setPname] = useState(project.name);
  const [pdesc, setPdesc] = useState(project.description || "");
  const [pdecimals, setPdecimals] = useState(project.settlementDecimals ?? 0);
  const [pdate, setPdate] = useState(project.date || todayStr());
  const [syncing, setSyncing] = useState(false);
  const [deleteStage, setDeleteStage] = useState(null); // null | 'password' | 'confirm'
  const [deletePw, setDeletePw] = useState("");
  const [deletePwError, setDeletePwError] = useState(false);
  // 「已付款」帶進表單的預填內容，無法用網址表達，所以放在元件狀態裡
  const [prefill, setPrefill] = useState(null);

  // 換頁時回到最上面，否則從清單中段點「編輯」會覺得沒反應
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, editor?.mode, editor?.expenseId]);

  useEffect(() => {
    if (!editor) setPrefill(null);
  }, [editor]);

  const resetDeleteStage = () => {
    setDeleteStage(null);
    setDeletePw("");
    setDeletePwError(false);
  };

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await onRefresh();
    } finally {
      setSyncing(false);
    }
  };

  const startEditProject = () => {
    setPname(project.name);
    setPdesc(project.description || "");
    setPdecimals(project.settlementDecimals ?? 0);
    setPdate(project.date || todayStr());
    resetDeleteStage();
    setEditingProject(true);
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

  return (
    <div>
      {editingProject ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="section-label">專案名稱</div>
          <input className="input" value={pname} onChange={(e) => setPname(e.target.value)} />
          <div className="section-label" style={{ marginTop: 12 }}>說明</div>
          <textarea className="input textarea" value={pdesc} onChange={(e) => setPdesc(e.target.value)} placeholder="這個專案是做什麼用的" />
          <div className="section-label" style={{ marginTop: 12 }}>專案日期</div>
          <DatePickerBox value={pdate} onChange={setPdate} />
          <div className="section-label" style={{ marginTop: 12 }}>金額顯示與結算位數</div>
          <div className="mode-switch mode-switch-3">
            <button className={pdecimals === 0 ? "on" : ""} onClick={() => setPdecimals(0)}>整數</button>
            <button className={pdecimals === 1 ? "on" : ""} onClick={() => setPdecimals(1)}>小數1位</button>
            <button className={pdecimals === 2 ? "on" : ""} onClick={() => setPdecimals(2)}>小數2位</button>
          </div>
          <div className="hint-text">這個專案裡所有 {project.baseCurrency} 金額都會用這個位數顯示與結算。</div>
          <div className="row-form" style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={() => { setEditingProject(false); resetDeleteStage(); }}>取消</button>
            <button
              className="btn-accent"
              disabled={!pname.trim()}
              onClick={() => {
                actions.updateProject(pname.trim(), pdesc.trim(), pdecimals, pdate);
                setEditingProject(false);
              }}
            >
              儲存
            </button>
          </div>

          <div className="section-label" style={{ marginTop: 20 }}>刪除專案</div>
          {deleteStage === null && (
            <button
              className="btn-outline btn-danger full-width"
              onClick={() => setDeleteStage(group.password ? "password" : "confirm")}
            >
              刪除專案
            </button>
          )}
          {deleteStage === "password" && (
            <div className="card subtle">
              <div className="section-label">請輸入群組密碼以繼續刪除</div>
              <input
                className="input mono"
                type="password"
                inputMode="numeric"
                value={deletePw}
                onChange={(e) => { setDeletePw(e.target.value); setDeletePwError(false); }}
              />
              {deletePwError && <div className="hint-text hint-warn">密碼不正確</div>}
              <div className="row-form" style={{ marginTop: 8 }}>
                <button className="btn-ghost" onClick={resetDeleteStage}>取消</button>
                <button
                  className="btn-accent"
                  onClick={() => {
                    if (deletePw === group.password || deletePw === MASTER_PASSWORD) {
                      setDeleteStage("confirm");
                      setDeletePw("");
                      setDeletePwError(false);
                    } else {
                      setDeletePwError(true);
                    }
                  }}
                >
                  下一步
                </button>
              </div>
            </div>
          )}
          {deleteStage === "confirm" && (
            <div className="card subtle">
              <div className="hint-text">
                確定要刪除「{project.name}」嗎？裡面 {expenses.length} 筆項目都會一併刪除，且無法復原。
              </div>
              <div className="row-form" style={{ marginTop: 8 }}>
                <button className="btn-ghost" onClick={resetDeleteStage}>取消</button>
                <button className="btn-accent" onClick={onDeleteProject}>確定刪除專案</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="topbar">
          <button className="backbtn" onClick={editor ? onCloseEditor : onBack} aria-label="返回">‹</button>
          <div className="topbar-text">
            <div className="topbar-title">{project.name}</div>
            {project.description && <div className="topbar-sub">{project.description}</div>}
            <div className="topbar-sub">
              {group.name} · 你是 {membersById[myId]?.name || "?"} ·{" "}
              <button className="link-btn" onClick={onSwitchIdentity}>切換身份</button>
            </div>
          </div>
          {!editor && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button className="edit-icon-btn" onClick={handleRefresh} disabled={syncing} aria-label="同步">
                {syncing ? "…" : "🔄"}
              </button>
              <button className="edit-icon-btn" onClick={startEditProject}>編輯</button>
            </div>
          )}
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
            allMembers={group.members}
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
              onDelete={actions.deleteExpense}
            />
          )}
          {tab === "settlement" && (
            <SettlementPage
              project={project}
              expenses={expenses}
              membersById={membersById}
              onModeChange={actions.setSettlementMode}
              onMarkPaid={markPaid}
            />
          )}
          {tab === "stats" && <StatsPage project={project} expenses={expenses} membersById={membersById} myId={myId} />}
          {tab === "members" && <ProjectMembers group={group} project={project} onToggle={actions.toggleProjectMember} />}
        </>
      )}
    </div>
  );
}
