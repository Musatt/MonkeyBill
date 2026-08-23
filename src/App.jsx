import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./styles.css";
import { useStore } from "./lib/useStore.js";
import { useRouter } from "./lib/useRouter.js";
import { uid, todayStr } from "./lib/format.js";
import { loadIdentity, saveIdentity, loadUnlocked, saveUnlocked } from "./lib/localPrefs.js";
import { SaveBanner } from "./components/primitives.jsx";
import { Home } from "./components/Home.jsx";
import { GroupLockScreen } from "./components/GroupLockScreen.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { GroupPage } from "./components/GroupPage.jsx";
import { MemberDetailPage } from "./components/MemberDetailPage.jsx";
import { ProjectView } from "./components/ProjectView.jsx";

const newMember = (name) => ({ id: uid("mem"), name, phone: "", bankCode: "", bankAccount: "", otherPayment: "" });

export default function App() {
  const { data, loading, err, persist, retry, refresh, saveState, retrySave } = useStore();
  const { route, navigate, replace, back } = useRouter();
  const [identity, setIdentity] = useState(loadIdentity);
  const [unlockedGroups, setUnlockedGroups] = useState(loadUnlocked);

  useEffect(() => saveIdentity(identity), [identity]);
  useEffect(() => saveUnlocked(unlockedGroups), [unlockedGroups]);

  const goHome = useCallback(() => navigate({ screen: "home" }), [navigate]);

  /* ---------- 目前畫面對應的資料 ---------- */
  const groups = useMemo(() => (data ? Object.values(data.groups) : []), [data]);
  const currentGroup = data && route.groupId ? data.groups[route.groupId] : null;
  const currentProject = data && route.projectId ? data.projects[route.projectId] : null;

  const projectsOfGroup = useMemo(
    () => (currentGroup && data ? Object.values(data.projects).filter((p) => p.groupId === currentGroup.id) : []),
    [currentGroup, data]
  );
  const membersById = useMemo(
    () => (currentGroup ? Object.fromEntries(currentGroup.members.map((m) => [m.id, m])) : {}),
    [currentGroup]
  );
  const expensesOfProject = useMemo(
    () => (currentProject && data ? Object.values(data.expenses).filter((e) => e.projectId === currentProject.id) : []),
    [currentProject, data]
  );
  const expensesOfGroup = useMemo(() => {
    if (!currentGroup || !data) return [];
    const ids = new Set(projectsOfGroup.map((p) => p.id));
    return Object.values(data.expenses).filter((e) => ids.has(e.projectId));
  }, [currentGroup, data, projectsOfGroup]);

  const currentMember = currentGroup && route.memberId ? membersById[route.memberId] : null;
  const myId = currentGroup ? identity[currentGroup.id] : null;
  // 身份指向的成員如果已被刪除或不存在，就當作還沒選身份
  const myMember = myId && currentGroup ? currentGroup.members.find((m) => m.id === myId && !m.deleted) : null;
  const needsOnboarding = !!currentGroup && !myMember;
  const isLocked = !!currentGroup && !!currentGroup.password && !unlockedGroups.has(currentGroup.id);

  /* ---------- 網址指到已不存在的資料時退回上一層 ---------- */
  useEffect(() => {
    if (!data || loading) return;
    if (route.groupId && !data.groups[route.groupId]) {
      replace({ screen: "home" });
    } else if (route.screen === "project" && route.projectId && !data.projects[route.projectId]) {
      replace({ screen: "group", groupId: route.groupId });
    } else if (route.screen === "member" && route.memberId && !membersById[route.memberId]) {
      replace({ screen: "group", groupId: route.groupId });
    }
  }, [data, loading, route, membersById, replace]);

  /* ---------- 群組 ---------- */
  const createGroup = (name, description, memberNames) => {
    const groupId = uid("g");
    const members = memberNames.map(newMember);
    persist((prev) => ({
      ...prev,
      groups: { ...prev.groups, [groupId]: { id: groupId, name, description, members, createdAt: Date.now() } },
    }));
    navigate({ screen: "group", groupId });
  };

  const updateGroupFields = (groupId, fields) =>
    persist((prev) => ({ ...prev, groups: { ...prev.groups, [groupId]: { ...prev.groups[groupId], ...fields } } }));

  const setGroupPassword = (groupId, password) => {
    updateGroupFields(groupId, { password });
    setUnlockedGroups((prev) => new Set([...prev, groupId]));
  };

  const deleteGroup = (groupId) => {
    persist((prev) => {
      const nextGroups = { ...prev.groups };
      delete nextGroups[groupId];
      const removedProjectIds = new Set();
      const nextProjects = {};
      Object.values(prev.projects).forEach((p) => {
        if (p.groupId === groupId) removedProjectIds.add(p.id);
        else nextProjects[p.id] = p;
      });
      const nextExpenses = {};
      Object.values(prev.expenses).forEach((e) => {
        if (!removedProjectIds.has(e.projectId)) nextExpenses[e.id] = e;
      });
      return { groups: nextGroups, projects: nextProjects, expenses: nextExpenses };
    });
    setIdentity((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    goHome();
  };

  const restoreData = (parsed) => {
    persist(
      () => ({ groups: parsed.groups || {}, projects: parsed.projects || {}, expenses: parsed.expenses || {} }),
      { replace: true }
    );
    goHome();
  };

  /* ---------- 成員 ---------- */
  const addMemberToGroup = (groupId, name) => {
    const member = newMember(name);
    persist((prev) => {
      const g = prev.groups[groupId];
      return { ...prev, groups: { ...prev.groups, [groupId]: { ...g, members: [...g.members, member] } } };
    });
    return member.id;
  };

  const updateMember = (groupId, memberId, updates) =>
    persist((prev) => {
      const g = prev.groups[groupId];
      return {
        ...prev,
        groups: {
          ...prev.groups,
          [groupId]: { ...g, members: g.members.map((m) => (m.id === memberId ? { ...m, ...updates } : m)) },
        },
      };
    });

  // 復原被軟刪除的成員：舊紀錄用的是同一個 id，所以歷史會自動接回去
  const reviveMember = (groupId, memberId) => {
    persist((prev) => {
      const g = prev.groups[groupId];
      return {
        ...prev,
        groups: {
          ...prev.groups,
          [groupId]: {
            ...g,
            members: g.members.map((m) => {
              if (m.id !== memberId) return m;
              const { deleted, ...rest } = m;
              return rest;
            }),
          },
        },
      };
    });
  };

  const deleteMember = (groupId, memberId) => {
    persist((prev) => {
      const g = prev.groups[groupId];
      const members = g.members.map((m) => (m.id === memberId ? { ...m, deleted: true } : m));
      const projects = { ...prev.projects };
      Object.values(prev.projects).forEach((p) => {
        if (p.groupId === groupId && p.memberIds.includes(memberId)) {
          const memberIds = p.memberIds.filter((id) => id !== memberId);
          const collectorId = p.collectorId === memberId ? memberIds[0] || null : p.collectorId;
          projects[p.id] = { ...p, memberIds, collectorId };
        }
      });
      // 支出／收入／轉帳紀錄完全不動，歷史保留
      return { ...prev, groups: { ...prev.groups, [groupId]: { ...g, members } }, projects };
    });
    // 刪掉的如果剛好是自己選的身份，清掉才不會卡在「我是一個不存在的人」
    setIdentity((prev) => {
      if (prev[groupId] !== memberId) return prev;
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  };

  const handleOnboardPick = (memberId, name, options = {}) => {
    if (memberId) {
      if (options.revive) reviveMember(currentGroup.id, memberId);
      setIdentity((prev) => ({ ...prev, [currentGroup.id]: memberId }));
    } else if (name) {
      const newId = addMemberToGroup(currentGroup.id, name);
      setIdentity((prev) => ({ ...prev, [currentGroup.id]: newId }));
    }
  };

  const switchIdentity = () => {
    setIdentity((prev) => {
      const next = { ...prev };
      delete next[currentGroup.id];
      return next;
    });
  };

  /* ---------- 專案 ---------- */
  const createProject = (name, description, memberIds, baseCurrency, settlementDecimals, date) => {
    const projectId = uid("p");
    persist((prev) => ({
      ...prev,
      projects: {
        ...prev.projects,
        [projectId]: {
          id: projectId,
          groupId: currentGroup.id,
          name,
          description,
          date: date || todayStr(),
          memberIds,
          baseCurrency,
          settlementDecimals,
          settlementMode: "min",
          collectorId: memberIds[0] || null,
          createdAt: Date.now(),
        },
      },
    }));
    navigate({ screen: "project", groupId: currentGroup.id, projectId, tab: "expenses" });
  };

  const updateCurrentProject = (fields) =>
    persist((prev) => ({
      ...prev,
      projects: { ...prev.projects, [currentProject.id]: { ...prev.projects[currentProject.id], ...fields } },
    }));

  const deleteProject = (projectId) => {
    persist((prev) => {
      const projects = { ...prev.projects };
      delete projects[projectId];
      const expenses = {};
      Object.values(prev.expenses).forEach((e) => {
        if (e.projectId !== projectId) expenses[e.id] = e;
      });
      return { ...prev, projects, expenses };
    });
    replace({ screen: "group", groupId: route.groupId });
  };

  const actions = useMemo(
    () => ({
      saveExpense: (expense) => persist((prev) => ({ ...prev, expenses: { ...prev.expenses, [expense.id]: expense } })),
      deleteExpense: (expenseId) =>
        persist((prev) => {
          const next = { ...prev.expenses };
          delete next[expenseId];
          return { ...prev, expenses: next };
        }),
      setSettlementMode: (mode, collectorId) => updateCurrentProject({ settlementMode: mode, collectorId }),
      toggleProjectMember: (memberId, on) =>
        persist((prev) => {
          const p = prev.projects[currentProject.id];
          const memberIds = on ? [...new Set([...p.memberIds, memberId])] : p.memberIds.filter((id) => id !== memberId);
          return { ...prev, projects: { ...prev.projects, [currentProject.id]: { ...p, memberIds } } };
        }),
      updateProject: (name, description, settlementDecimals, date) =>
        updateCurrentProject({ name, description, settlementDecimals, date }),
    }),
    [persist, currentProject]
  );

  /* ---------- 畫面 ---------- */
  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <div className="loading">載入中…</div>
        </div>
      </div>
    );
  }
  if (err || !data) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <div className="loading">
            <div>連不上雲端資料，請稍後再試</div>
            <div className="loading-detail">{err}</div>
            <div className="hint-text" style={{ marginTop: 10 }}>（為了保護你的帳，讀不到資料時不會顯示或寫入任何東西）</div>
            <button className="btn-accent" style={{ marginTop: 14 }} onClick={retry}>重新載入</button>
          </div>
        </div>
      </div>
    );
  }

  let content;
  if (currentGroup && isLocked) {
    content = (
      <GroupLockScreen
        group={currentGroup}
        onBack={goHome}
        onUnlock={() => setUnlockedGroups((prev) => new Set([...prev, currentGroup.id]))}
      />
    );
  } else if (currentGroup && needsOnboarding) {
    content = <Onboarding group={currentGroup} onPick={handleOnboardPick} onBack={goHome} />;
  } else if (route.screen === "member" && currentGroup && currentMember) {
    content = (
      <MemberDetailPage
        member={currentMember}
        groupName={currentGroup.name}
        groupMembers={currentGroup.members}
        projects={projectsOfGroup}
        expenses={expensesOfGroup}
        isMe={currentMember.id === myId}
        onBack={back}
        onUpdate={(updates) => updateMember(currentGroup.id, currentMember.id, updates)}
        onDelete={() => {
          deleteMember(currentGroup.id, currentMember.id);
          replace({ screen: "group", groupId: currentGroup.id });
        }}
      />
    );
  } else if (route.screen === "project" && currentGroup && currentProject) {
    content = (
      <ProjectView
        group={currentGroup}
        project={currentProject}
        expenses={expensesOfProject}
        membersById={membersById}
        myId={myId}
        onSwitchIdentity={switchIdentity}
        onBack={back}
        tab={route.tab}
        onTabChange={(tab) => replace({ ...route, tab, editor: null })}
        editor={route.editor}
        onOpenEditor={(mode, expenseId) => navigate({ ...route, editor: { mode, expenseId } })}
        onCloseEditor={() => replace({ ...route, editor: null })}
        actions={actions}
        onRefresh={refresh}
        onDeleteProject={() => deleteProject(currentProject.id)}
      />
    );
  } else if (route.screen === "group" && currentGroup) {
    content = (
      <GroupPage
        group={currentGroup}
        projects={projectsOfGroup}
        expenses={expensesOfGroup}
        myId={myId}
        onBack={back}
        onOpenProject={(projectId) => navigate({ screen: "project", groupId: currentGroup.id, projectId, tab: "expenses" })}
        onCreateProject={createProject}
        onAddMember={(name) => addMemberToGroup(currentGroup.id, name)}
        onReviveMember={(memberId) => reviveMember(currentGroup.id, memberId)}
        onOpenMember={(memberId) => navigate({ screen: "member", groupId: currentGroup.id, memberId })}
        onUpdateGroup={(name, description) => updateGroupFields(currentGroup.id, { name, description })}
        onSwitchIdentity={switchIdentity}
        onSetPassword={(password) => setGroupPassword(currentGroup.id, password)}
        onRemovePassword={() => updateGroupFields(currentGroup.id, { password: null })}
        onDeleteGroup={() => deleteGroup(currentGroup.id)}
      />
    );
  } else {
    content = (
      <Home
        groups={groups}
        onOpenGroup={(groupId) => navigate({ screen: "group", groupId })}
        onCreateGroup={createGroup}
        data={data}
        onRestore={restoreData}
        onRefresh={refresh}
      />
    );
  }

  return (
    <div className="app-shell">
      <div className="app-frame">
        <SaveBanner saveState={saveState} onRetry={retrySave} />
        {content}
      </div>
    </div>
  );
}
