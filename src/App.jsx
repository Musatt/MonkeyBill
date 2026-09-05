import React, { useState, useEffect, useMemo, useCallback } from "react";
import "./styles.css";
import { useStore } from "./lib/useStore.js";
import { useRouter, buildHash } from "./lib/useRouter.js";
import { uid, todayStr } from "./lib/format.js";
import { loadSession, saveSession } from "./lib/session.js";
import {
  isGroupAdmin,
  canDeleteProject,
  canDeleteGroup,
  canDeleteExpense,
  deleteExpenseReason,
} from "./lib/permissions.js";
import { SaveBanner } from "./components/primitives.jsx";
import { LoginScreen, BackstageLogin } from "./components/LoginScreen.jsx";
import { BackstageScreen } from "./components/BackstageScreen.jsx";
import { Home } from "./components/Home.jsx";
import { GroupPage } from "./components/GroupPage.jsx";
import { GroupEditScreen } from "./components/GroupEditScreen.jsx";
import { GroupMembersScreen } from "./components/GroupMembersScreen.jsx";
import { UserProfilePage } from "./components/UserProfilePage.jsx";
import { ProjectView } from "./components/ProjectView.jsx";
import { ProjectEditScreen } from "./components/ProjectEditScreen.jsx";
import { ShareModal } from "./components/ShareModal.jsx";

const newUser = (name, passwordHash = null) => ({
  id: uid("mem"),
  name,
  passwordHash,
  phone: "",
  bankCode: "",
  bankAccount: "",
  otherPayment: "",
  disabled: false,
  createdAt: Date.now(),
});

export default function App() {
  const { data, loading, err, persist, retry, refresh, saveState, retrySave } = useStore();
  const { route, navigate, replace, up } = useRouter();
  const [session, setSession] = useState(loadSession);
  const [backstageGate, setBackstageGate] = useState(false);
  const [sharing, setSharing] = useState(null);

  useEffect(() => saveSession(session), [session]);

  const goHome = useCallback(() => navigate({ screen: "home" }), [navigate]);
  const goUp = useCallback(() => up(route), [up, route]);

  const shareUrlFor = useCallback((target) => {
    const { origin, pathname } = window.location;
    return `${origin}${pathname}${buildHash(target)}`;
  }, []);

  /* ---------- 目前的身分 ---------- */
  const backstage = session.backstage;
  const me = data && session.userId ? data.users[session.userId] : null;
  const loggedIn = backstage || (!!me && !me.disabled);
  const myId = me ? me.id : null;

  /* ---------- 目前畫面對應的資料 ---------- */
  const currentGroup = data && route.groupId ? data.groups[route.groupId] : null;
  const currentProject = data && route.projectId ? data.projects[route.projectId] : null;
  const currentUser = data && route.userId ? data.users[route.userId] : null;

  // 只看得到自己有份的群組；後臺看得到全部
  const visibleGroups = useMemo(() => {
    if (!data) return [];
    const all = Object.values(data.groups);
    return backstage ? all : all.filter((g) => g.memberIds.includes(myId));
  }, [data, backstage, myId]);

  const canSeeGroup = !!currentGroup && (backstage || currentGroup.memberIds.includes(myId));
  const amAdmin = isGroupAdmin(currentGroup, myId, backstage);

  const projectsOfGroup = useMemo(
    () => (currentGroup && data ? Object.values(data.projects).filter((p) => p.groupId === currentGroup.id) : []),
    [currentGroup, data]
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

  /* ---------- 網址指到已不存在的資料時退回 ---------- */
  useEffect(() => {
    if (!data || loading || !loggedIn) return;
    if (route.groupId && !data.groups[route.groupId]) replace({ screen: "home" });
    else if (route.screen === "user" && route.userId && !data.users[route.userId]) replace({ screen: "home" });
    else if (route.screen === "project" && route.projectId && !data.projects[route.projectId]) {
      replace({ screen: "group", groupId: route.groupId });
    }
  }, [data, loading, loggedIn, route, replace]);

  /* ---------- 帳號 ---------- */
  const createUser = (name, passwordHash) => {
    const u = newUser(name, passwordHash);
    persist((prev) => ({ ...prev, users: { ...prev.users, [u.id]: u } }));
    return u.id;
  };

  const updateUser = (userId, updates) =>
    persist((prev) => ({ ...prev, users: { ...prev.users, [userId]: { ...prev.users[userId], ...updates } } }));

  const setUserPassword = (userId, passwordHash) => updateUser(userId, { passwordHash });
  const setUserDisabled = (userId, disabled) => updateUser(userId, { disabled });

  const deleteUser = (userId) =>
    persist((prev) => {
      const users = { ...prev.users };
      delete users[userId];
      return { ...prev, users };
    });

  /* ---------- 群組 ---------- */
  const createGroup = (name, description, memberIds) => {
    const groupId = uid("g");
    persist((prev) => ({
      ...prev,
      groups: {
        ...prev.groups,
        [groupId]: {
          id: groupId,
          name,
          description,
          memberIds: [...new Set(memberIds)],
          adminIds: myId ? [myId] : [], // 建立者就是管理者
          inactiveMemberIds: [],
          createdAt: Date.now(),
        },
      },
    }));
    navigate({ screen: "group", groupId });
  };

  const updateGroupFields = (groupId, fields) =>
    persist((prev) => ({ ...prev, groups: { ...prev.groups, [groupId]: { ...prev.groups[groupId], ...fields } } }));

  const deleteGroup = (groupId) => {
    persist((prev) => {
      const groups = { ...prev.groups };
      delete groups[groupId];
      const removed = new Set();
      const projects = {};
      Object.values(prev.projects).forEach((p) => {
        if (p.groupId === groupId) removed.add(p.id);
        else projects[p.id] = p;
      });
      const expenses = {};
      Object.values(prev.expenses).forEach((e) => {
        if (!removed.has(e.projectId)) expenses[e.id] = e;
      });
      return { ...prev, groups, projects, expenses };
    });
    goHome();
  };

  const groupAction = (groupId, fn) =>
    persist((prev) => {
      const g = prev.groups[groupId];
      const next = fn(g, prev);
      if (!next) return prev;
      return { ...prev, groups: { ...prev.groups, [groupId]: next }, ...(next.__extra || {}) };
    });

  const addMemberToGroup = (groupId, userId) =>
    groupAction(groupId, (g) =>
      g.memberIds.includes(userId) ? null : { ...g, memberIds: [...g.memberIds, userId] }
    );

  const createUserInGroup = (groupId, name, passwordHash) => {
    const u = newUser(name, passwordHash);
    persist((prev) => {
      const g = prev.groups[groupId];
      return {
        ...prev,
        users: { ...prev.users, [u.id]: u },
        groups: { ...prev.groups, [groupId]: { ...g, memberIds: [...g.memberIds, u.id] } },
      };
    });
  };

  const removeMemberFromGroup = (groupId, userId) =>
    persist((prev) => {
      const g = prev.groups[groupId];
      const group = {
        ...g,
        memberIds: g.memberIds.filter((id) => id !== userId),
        adminIds: (g.adminIds || []).filter((id) => id !== userId),
        inactiveMemberIds: (g.inactiveMemberIds || []).filter((id) => id !== userId),
      };
      // 專案名單也要一起清掉，否則會留下一個不在群組的人
      const projects = { ...prev.projects };
      Object.values(prev.projects).forEach((p) => {
        if (p.groupId === groupId && p.memberIds.includes(userId)) {
          const memberIds = p.memberIds.filter((id) => id !== userId);
          projects[p.id] = {
            ...p,
            memberIds,
            collectorId: p.collectorId === userId ? memberIds[0] || null : p.collectorId,
          };
        }
      });
      return { ...prev, groups: { ...prev.groups, [groupId]: group }, projects };
    });

  const setMemberInactive = (groupId, userId, inactive) =>
    groupAction(groupId, (g) => {
      const set = new Set(g.inactiveMemberIds || []);
      if (inactive) set.add(userId);
      else set.delete(userId);
      return { ...g, inactiveMemberIds: [...set] };
    });

  const setGroupAdmin = (groupId, userId, makeAdmin) =>
    groupAction(groupId, (g) => {
      const set = new Set(g.adminIds || []);
      if (makeAdmin) set.add(userId);
      else {
        if (set.size <= 1) return null; // 不能把最後一個管理者拔掉
        set.delete(userId);
      }
      return { ...g, adminIds: [...set] };
    });

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
          createdBy: myId,
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

  const deleteProject = (projectId, groupId) => {
    // groupId 為 null 代表從後臺刪的，後臺沒有群組頁可回，不要導覽
    persist((prev) => {
      const projects = { ...prev.projects };
      delete projects[projectId];
      const expenses = {};
      Object.values(prev.expenses).forEach((e) => {
        if (e.projectId !== projectId) expenses[e.id] = e;
      });
      return { ...prev, projects, expenses };
    });
    if (groupId) replace({ screen: "group", groupId });
  };

  const restoreData = (parsed) => {
    persist(() => parsed, { replace: true });
    goHome();
  };

  const actions = useMemo(
    () => ({
      saveExpense: (expense) =>
        persist((prev) => {
          const existing = prev.expenses[expense.id];
          return {
            ...prev,
            expenses: {
              ...prev.expenses,
              // 編輯不改建立者，新增才記
              [expense.id]: { ...expense, createdBy: existing ? existing.createdBy : myId },
            },
          };
        }),
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
      setProjectMemberOrder: (orderedIds) =>
        persist((prev) => {
          const p = prev.projects[currentProject.id];
          const rest = p.memberIds.filter((id) => !orderedIds.includes(id));
          const memberIds = [...orderedIds, ...rest];
          if (memberIds.join() === p.memberIds.join()) return prev;
          return { ...prev, projects: { ...prev.projects, [currentProject.id]: { ...p, memberIds } } };
        }),
      updateProject: (name, description, settlementDecimals, date) =>
        updateCurrentProject({ name, description, settlementDecimals, date }),
    }),
    [persist, currentProject, myId]
  );

  const perms = useMemo(
    () => ({
      canDeleteExpenseById: (id) => {
        const e = data?.expenses[id];
        return {
          ok: canDeleteExpense(e, currentGroup, myId, backstage),
          reason: deleteExpenseReason(e, currentGroup, myId, backstage),
        };
      },
    }),
    [data, currentGroup, myId, backstage]
  );

  /* ---------- 載入 / 錯誤 ---------- */
  if (loading) {
    return (
      <div className="app-shell">
        <div className="app-frame"><div className="loading">載入中…</div></div>
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

  /* ---------- 尚未登入 ---------- */
  if (!loggedIn) {
    const shell = (inner) => (
      <div className="app-shell">
        <div className="app-frame">
          <SaveBanner saveState={saveState} onRetry={retrySave} />
          {inner}
        </div>
      </div>
    );
    if (backstageGate) {
      return shell(
        <BackstageLogin
          onEnter={() => {
            setBackstageGate(false);
            setSession({ userId: null, backstage: true });
          }}
          onCancel={() => setBackstageGate(false)}
        />
      );
    }
    return shell(
      <LoginScreen
        users={data.users}
        onLogin={(userId) => setSession({ userId, backstage: false })}
        onCreate={(name, passwordHash) => setSession({ userId: createUser(name, passwordHash), backstage: false })}
        onBackstage={() => setBackstageGate(true)}
      />
    );
  }

  const logout = () => {
    setSession({ userId: null, backstage: false });
    replace({ screen: "home" });
  };

  /* ---------- 後臺管理 ---------- */
  if (backstage) {
    return (
      <div className="app-shell">
        <div className="app-frame">
          <SaveBanner saveState={saveState} onRetry={retrySave} />
          <BackstageScreen
            data={data}
            onExit={logout}
            actions={{ setUserDisabled, deleteUser, deleteGroup, deleteProject: (id) => deleteProject(id, null) }}
          />
        </div>
      </div>
    );
  }

  /* ---------- 一般畫面 ---------- */
  let content;
  const blockedScreen = (eyebrow, title, desc, backTo) => (
    <div className="screen">
      <div className="onboard-hero">
        <div className="onboard-eyebrow">{eyebrow}</div>
        <div className="onboard-title">{title}</div>
        <div className="onboard-desc">{desc}</div>
      </div>
      <button className="btn-accent full-width" style={{ marginTop: 14 }} onClick={backTo}>
        {backTo === goHome ? "回到我的群組" : "回到群組"}
      </button>
    </div>
  );

  const notInGroup = blockedScreen(
    "看不到這個群組",
    "你不在這個群組",
    currentGroup
      ? `「${currentGroup.name}」的成員才看得到內容。請群組管理者把你加進去。`
      : "這個群組不存在，或已經被刪除。",
    goHome
  );

  // 是成員但不是管理者：跟「不在群組」是兩回事，訊息不能混用
  const notAdmin = blockedScreen(
    "權限不足",
    "只有管理者能做這件事",
    `你是「${currentGroup?.name || ""}」的成員，但不是管理者。需要的話請管理者把你設為管理者。`,
    () => navigate({ screen: "group", groupId: route.groupId })
  );

  if (route.screen === "user" && currentUser) {
    content = (
      <UserProfilePage
        user={currentUser}
        data={data}
        viewerId={myId}
        backstage={backstage}
        visibleGroups={visibleGroups}
        onBack={goUp}
        onUpdate={updateUser}
        onSetPassword={setUserPassword}
      />
    );
  } else if (route.groupId && !canSeeGroup) {
    content = notInGroup;
  } else if (route.screen === "group" && currentGroup && route.settings) {
    content = !amAdmin ? notAdmin : (
      <GroupEditScreen
        group={currentGroup}
        projectCount={projectsOfGroup.length}
        expenseCount={expensesOfGroup.length}
        canDelete={canDeleteGroup(currentGroup, myId, backstage)}
        onBack={goUp}
        onSave={(name, description) => {
          updateGroupFields(currentGroup.id, { name, description });
          goUp();
        }}
        onDeleteGroup={() => deleteGroup(currentGroup.id)}
      />
    );
  } else if (route.screen === "group" && currentGroup && route.members) {
    content = amAdmin ? (
      <GroupMembersScreen
        group={currentGroup}
        data={data}
        myId={myId}
        backstage={backstage}
        onBack={goUp}
        actions={{ addMemberToGroup, createUserInGroup, removeMemberFromGroup, setMemberInactive, setGroupAdmin }}
      />
    ) : (
      notAdmin
    );
  } else if (route.screen === "project" && currentGroup && currentProject && route.settings) {
    content = (
      <ProjectEditScreen
        project={currentProject}
        expenseCount={expensesOfProject.length}
        canDelete={canDeleteProject(currentGroup, myId, backstage)}
        onBack={goUp}
        onSave={(name, description, settlementDecimals, date) => {
          actions.updateProject(name, description, settlementDecimals, date);
          goUp();
        }}
        onDeleteProject={() => deleteProject(currentProject.id, currentGroup.id)}
      />
    );
  } else if (route.screen === "project" && currentGroup && currentProject) {
    content = (
      <ProjectView
        group={currentGroup}
        users={data.users}
        project={currentProject}
        expenses={expensesOfProject}
        membersById={data.users}
        myId={myId}
        perms={perms}
        onBack={goUp}
        tab={route.tab}
        onTabChange={(tab) => replace({ ...route, tab, editor: null })}
        editor={route.editor}
        onOpenEditor={(mode, expenseId) => navigate({ ...route, editor: { mode, expenseId } })}
        onCloseEditor={goUp}
        onOpenSettings={() => navigate({ ...route, editor: null, settings: true })}
        onShare={() =>
          setSharing({
            title: currentProject.name,
            subtitle: `${currentGroup.name} 的專案`,
            url: shareUrlFor({ screen: "project", groupId: currentGroup.id, projectId: currentProject.id, tab: "expenses" }),
            note: "只有這個群組的成員打得開。",
          })
        }
        actions={actions}
        onRefresh={refresh}
      />
    );
  } else if (route.screen === "group" && currentGroup) {
    content = (
      <GroupPage
        group={currentGroup}
        users={data.users}
        projects={projectsOfGroup}
        expenses={expensesOfGroup}
        myId={myId}
        isAdmin={amAdmin}
        onBack={goUp}
        onOpenProject={(projectId) => navigate({ screen: "project", groupId: currentGroup.id, projectId, tab: "expenses" })}
        onCreateProject={createProject}
        onOpenMember={(userId) => navigate({ screen: "user", userId })}
        onOpenSettings={() => navigate({ screen: "group", groupId: currentGroup.id, settings: true })}
        onOpenMembers={() => navigate({ screen: "group", groupId: currentGroup.id, members: true })}
        onShare={() =>
          setSharing({
            title: currentGroup.name,
            subtitle: "分帳本群組",
            url: shareUrlFor({ screen: "group", groupId: currentGroup.id }),
            note: "只有這個群組的成員打得開。",
          })
        }
      />
    );
  } else {
    content = (
      <Home
        me={me}
        groups={visibleGroups}
        users={data.users}
        onOpenGroup={(groupId) => navigate({ screen: "group", groupId })}
        onCreateGroup={createGroup}
        onLogout={logout}
        onOpenProfile={() => navigate({ screen: "user", userId: myId })}
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
        {sharing && <ShareModal {...sharing} onClose={() => setSharing(null)} />}
      </div>
    </div>
  );
}
