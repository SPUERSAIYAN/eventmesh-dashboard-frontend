import { useEffect, useMemo, useState } from "react";
import {
  ApiOutlined, AppstoreOutlined, CheckCircleFilled, CloudServerOutlined,
  ClusterOutlined, CopyOutlined, DashboardOutlined, DatabaseOutlined,
  DownOutlined, ExclamationCircleFilled, InfoCircleFilled,
  LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ReloadOutlined, SearchOutlined, TeamOutlined, ToolOutlined, GlobalOutlined,
  CheckOutlined, CloseOutlined, LockOutlined, SafetyCertificateOutlined, LogoutOutlined, UserOutlined,
} from "@ant-design/icons";
import { Alert, Button, ConfigProvider, Dropdown, Input, Modal, Pagination, Progress, Select, Spin, Tag, Tooltip } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import eventMeshLogo from "./assets/eventmesh-logo.svg";
import { clusterDetailPlaceholder, clusterListPlaceholder, dashboardRepository } from "./api/dashboardRepository.js";
import { apiClient } from "./api/client.js";
import { unwrapPayload } from "./api/contracts.js";
import { resourceRepository } from "./api/resourceRepository.js";
import { useAuth } from "./AuthProvider.jsx";
import { useI18n } from "./i18n.jsx";
import { usePermissions } from "./PermissionProvider.jsx";
import { PERMISSIONS, ROLE_DEFINITIONS, roleCan } from "./permissions.js";

const navItems = [
  { key: "overview", label: "Overview", icon: DashboardOutlined, path: "/overview" },
  { key: "clusters", label: "Clusters", icon: ClusterOutlined, path: "/clusters" },
  { key: "topics", label: "Topics", icon: AppstoreOutlined, path: "/topics" },
  { key: "groups", label: "Consumer Groups", icon: TeamOutlined, path: "/groups" },
  { key: "connections", label: "Connections", icon: LinkOutlined, path: "/connections" },
  { key: "operations", label: "Operations", icon: ToolOutlined, path: "/operations", permission: PERMISSIONS.VIEW_OPERATIONS },
  { key: "organization", label: "Members", icon: TeamOutlined, path: "/organization/members", permission: PERMISSIONS.MANAGE_MEMBERS },
];

const permissionMatrix = [
  ["View console", PERMISSIONS.VIEW_CONSOLE],
  ["Create clusters", PERMISSIONS.CREATE_CLUSTER],
  ["Manage clusters", PERMISSIONS.MANAGE_CLUSTER],
  ["View operation history", PERMISSIONS.VIEW_OPERATIONS],
  ["Manage organization members", PERMISSIONS.MANAGE_MEMBERS],
  ["Assign organization roles", PERMISSIONS.ASSIGN_ROLES],
  ["Manage system settings", PERMISSIONS.SYSTEM_SETTINGS],
];

function Shell({ children }) {
  const { language, t, toggleLanguage } = useI18n();
  const { can, roleDefinition } = usePermissions();
  const { user, organizations, currentOrganizationId, switchOrganization, logout } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [switchingOrganization, setSwitchingOrganization] = useState(false);
  const activeKey = location.pathname.split("/").filter(Boolean)[0] || "overview";
  const activeItem = navItems.find((item) => item.key === activeKey) ?? navItems[0];
  const isClusterDetail = activeKey === "clusters" && location.pathname !== "/clusters";
  const detailLabel = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
  const userMenu = {
    items: [
      { key: "identity", disabled: true, label: <span className="role-menu-item"><strong>{user?.displayName || user?.username}</strong><small>{t(roleDefinition.label)}</small></span> },
      { type: "divider" },
      { key: "permission-policy", icon: <SafetyCertificateOutlined />, label: t("Permission policy") },
      { key: "logout", icon: <LogoutOutlined />, label: t("Sign out") },
    ],
    onClick: ({ key }) => key === "permission-policy" ? setPermissionsOpen(true) : key === "logout" ? logout() : null,
  };
  const changeOrganization = async (organizationId) => {
    setSwitchingOrganization(true);
    try {
      await switchOrganization(organizationId);
      queryClient.clear();
      navigate("/overview");
    } finally {
      setSwitchingOrganization(false);
    }
  };
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <button className="brand" aria-label={t("EventMesh home")} onClick={() => navigate("/overview")}><img src={eventMeshLogo} alt="EventMesh" /></button>
        <nav className="side-nav" aria-label={t("Primary navigation")}>
          {navItems.map(({ key, label, icon: Icon, path, permission }) => {
            const allowed = !permission || can(permission);
            return <Tooltip key={key} placement="right" title={!allowed ? t("You do not have permission to perform this action.") : collapsed ? t(label) : ""}>
              <button className={key === activeKey ? "active" : ""} disabled={!allowed} onClick={() => allowed && navigate(path)}>
                <Icon /><span>{t(label)}</span>{!allowed && <LockOutlined className="nav-lock" />}
              </button>
            </Tooltip>;
          })}
        </nav>
        <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}<span>{t(collapsed ? "Expand" : "Collapse")}</span>
        </button>
      </aside>

      <header className="topbar">
        <div className="breadcrumb">
          <button onClick={() => navigate(activeItem.path)}>{t(activeItem.label)}</button>
          {isClusterDetail && <><span>/</span><strong>{detailLabel}</strong></>}
        </div>
        <div className="top-actions">
          <Select className="environment-select" value={currentOrganizationId} loading={switchingOrganization} onChange={changeOrganization} options={organizations.map((organization) => ({ value: organization.id, label: <span><small>{t("Organization")}</small><b>{organization.name}</b></span> }))} />
          <Tooltip title={t(language === "en" ? "Switch to Chinese" : "Switch to English")}><Button className="language-toggle" icon={<GlobalOutlined />} onClick={toggleLanguage}>{language === "en" ? "中" : "EN"}</Button></Tooltip>
          <Dropdown menu={userMenu} trigger={["click"]} placement="bottomRight">
            <button className="role-switcher" aria-label={`${t("Current role")}: ${t(roleDefinition.label)}`}><span className="avatar">{(user?.displayName || user?.username || "U").slice(0, 1).toUpperCase()}</span><span className="role-copy"><small>{user?.username}</small><b>{t(roleDefinition.label)}</b></span><DownOutlined /></button>
          </Dropdown>
        </div>
      </header>
      <main className="workspace">{children}</main>
      <StatusBar />
      <Modal title={t("Role permission matrix")} open={permissionsOpen} onCancel={() => setPermissionsOpen(false)} footer={<Button type="primary" onClick={() => setPermissionsOpen(false)}>{t("Done")}</Button>} width={860}>
        <div className="permission-policy"><p>{t("Role preview only changes frontend authorization. Production security must also validate the signed-in user on the server.")}</p><div className="permission-table-wrap"><table><thead><tr><th>{t("Permission")}</th>{ROLE_DEFINITIONS.map((item) => <th key={item.key}>{t(item.label)}</th>)}</tr></thead><tbody>{permissionMatrix.map(([label, permission]) => <tr key={permission}><td>{t(label)}</td>{ROLE_DEFINITIONS.map((item) => { const allowed = roleCan(item.key, permission); return <td key={item.key} aria-label={t(allowed ? "Allowed" : "Not allowed")}>{allowed ? <CheckOutlined /> : <CloseOutlined />}</td>; })}</tr>)}</tbody></table></div></div>
      </Modal>
    </div>
  );
}

function StatusBar() {
  const { locale, t } = useI18n();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };
  return (
    <footer className="statusbar">
      <span className="status-ok"><i />{t("All systems operational")}</span>
      <span className="local-time">{t("Local time")}&nbsp;&nbsp; {now.toLocaleString(locale, { hour12: false, timeZoneName: "short" })}</span>
      <button onClick={refresh}><ReloadOutlined spin={refreshing} /> {t("Refresh")}&nbsp; 10s</button><DownOutlined />
    </footer>
  );
}

function OverviewPage() {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const includeOperations = can(PERMISSIONS.VIEW_OPERATIONS);
  const { data, isFetching, error } = useQuery({
    queryKey: ["resources", "overview", includeOperations],
    queryFn: () => resourceRepository.getOverview({ includeOperations }),
  });
  const runtimeCount = data?.resources.reduce((sum, item) => sum + item.runtimes, 0) ?? 0;
  const topicCount = data?.resources.reduce((sum, item) => sum + item.topics, 0) ?? 0;
  const groupCount = data?.resources.reduce((sum, item) => sum + item.groups, 0) ?? 0;
  const activeConnections = data?.connections.filter((item) => Number(item.status) === 1).length ?? 0;
  return (
    <div className="page resource-page">
      <ResourceHeading title={t("Overview")} description={t("Live operational inventory from EventMesh Dashboard and MySQL.")} loading={isFetching} />
      {error ? <ApiError error={error} /> : <>
        <section className="overview-metrics resource-metrics">
          <MetricCard label={t("Clusters")} value={data?.clusters.length ?? 0} note={t("Registered clusters")} icon={<ClusterOutlined />} />
          <MetricCard label={t("Runtimes")} value={runtimeCount} note={t("Database instances")} icon={<DatabaseOutlined />} />
          <MetricCard label={t("Topics")} value={topicCount} note={language === "zh" ? `${groupCount} 个消费组` : `${groupCount} consumer groups`} icon={<AppstoreOutlined />} />
          <MetricCard label={t("Connections")} value={activeConnections} note={t("Currently connected")} icon={<LinkOutlined />} tone="green" />
        </section>
        <section className={`overview-resource-grid ${!includeOperations ? "single" : ""}`}>
          <article className="panel overview-clusters">
            <div className="resource-card-title"><div><h2>{t("Cluster inventory")}</h2><span>{language === "zh" ? `${data?.clusters.length ?? 0} 个集群` : `${data?.clusters.length ?? 0} clusters`}</span></div><button onClick={() => navigate("/clusters")}>{t("View clusters")}</button></div>
            <div className="inventory-list">{data?.resources.map(({ cluster, runtimes, topics, groups }) => <button key={cluster.id} onClick={() => navigate(`/clusters/${cluster.id}`)}><span className="cluster-name-icon"><ClusterOutlined /></span><span><strong>{cluster.name}</strong><small>{language === "zh" ? `${runtimes} 个 Runtime · ${topics} 个主题 · ${groups} 个消费组` : `${runtimes} runtimes · ${topics} topics · ${groups} groups`}</small></span><b>›</b></button>)}</div>
          </article>
          {includeOperations && <article className="panel overview-operations">
            <div className="resource-card-title"><div><h2>{t("Recent operations")}</h2><span>{t("Stored in operation_log")}</span></div><button onClick={() => navigate("/operations")}>{t("View all")}</button></div>
            <div className="operation-preview">{data?.operations.slice(0, 6).map((item) => <div key={item.id}><StatusPill value={item.state} kind="operation" /><span><strong>{t(item.content)}</strong><small>{item.operationUser} · {formatDateTime(item.createTime)}</small></span></div>)}</div>
          </article>}
        </section>
      </>}
    </div>
  );
}

const resourceConfig = {
  topics: {
    title: "Topics", description: "Topics synchronized from all registered EventMesh clusters.", loader: () => resourceRepository.getTopics(),
    search: (item) => `${item.topicName} ${item.clusterName} ${item.topicType}`,
    columns: [
      ["Topic", (item) => <span className="primary-cell"><AppstoreOutlined /><span><strong>{item.topicName}</strong><small>#{item.id}</small></span></span>],
      ["Cluster", (item) => item.clusterName], ["Type", (item) => item.topicType || "—"],
      ["Read / Write queues", (item) => `${item.readQueueNum ?? 0} / ${item.writeQueueNum ?? 0}`],
      ["Status", (item) => <StatusPill value={item.status} />], ["Updated", (item) => formatDateTime(item.updateTime)],
    ],
  },
  groups: {
    title: "Consumer Groups", description: "Consumer and producer groups stored in the EventMesh Dashboard database.", loader: () => resourceRepository.getGroups(),
    search: (item) => `${item.name} ${item.clusterName} ${item.state}`,
    columns: [
      ["Group", (item) => <span className="primary-cell"><TeamOutlined /><span><strong>{item.name}</strong><small>#{item.id}</small></span></span>],
      ["Cluster", (item) => item.clusterName], ["Role", (item, t) => t(Number(item.type) === 0 ? "Consumer" : "Producer")],
      ["State", (item) => <StatusPill value={item.state || item.status} />], ["Owner type", (item) => item.ownType || "—"],
      ["Updated", (item) => formatDateTime(item.updateTime)],
    ],
  },
  connections: {
    title: "Connections", description: "Client-to-Runtime network connections from the net_connection table.", loader: () => resourceRepository.getConnections(),
    search: (item) => `${item.clientHost} ${item.runtimeHost} ${item.clusterName} ${item.description}`,
    columns: [
      ["Client", (item, t) => <span className="primary-cell"><LinkOutlined /><span><strong>{item.clientHost}:{item.clientPort}</strong><small>{t("Connection")} #{item.id}</small></span></span>],
      ["Runtime", (item) => `${item.runtimeHost}:${item.runtimePort}`], ["Cluster", (item) => item.clusterName],
      ["Status", (item) => <StatusPill value={item.status} kind="connection" />], ["Connected at", (item) => formatDateTime(item.connectionTime)],
      ["Description", (item) => item.description || "—"],
    ],
  },
  operations: {
    title: "Operations", description: "Auditable cluster activity stored in the operation_log table.", loader: () => resourceRepository.getOperations(),
    search: (item) => `${item.content} ${item.clusterName} ${item.operationType} ${item.targetType} ${item.operationUser}`,
    columns: [
      ["Operation", (item, t) => <span className="primary-cell"><ToolOutlined /><span><strong>{t(item.content)}</strong><small>{t(item.result)}</small></span></span>],
      ["Cluster", (item) => item.clusterName], ["Target", (item) => item.targetType], ["Type", (item) => item.operationType],
      ["User", (item) => item.operationUser], ["State", (item) => <StatusPill value={item.state} kind="operation" />],
      ["Created", (item) => formatDateTime(item.createTime)],
    ],
  },
};

function ResourcePage({ type }) {
  const { language, t } = useI18n();
  const config = resourceConfig[type];
  const [query, setQuery] = useState("");
  const [clusterId, setClusterId] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const navigate = useNavigate();
  const { data: result, isFetching, error, refetch } = useQuery({ queryKey: ["resources", type], queryFn: config.loader });
  const rows = (result?.data ?? []).filter((item) => (clusterId === "all" || String(item.clusterId) === clusterId) && config.search(item).toLowerCase().includes(query.toLowerCase()));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const clusterOptions = [{ value: "all", label: t("All clusters") }, ...(result?.clusters ?? []).map((cluster) => ({ value: String(cluster.id), label: cluster.name }))];
  return <div className="page resource-page">
    <ResourceHeading title={t(config.title)} description={t(config.description)} loading={isFetching} action={<Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>} />
    {error ? <ApiError error={error} /> : <section className="panel resource-list-panel">
      <div className="panel-toolbar"><div><h2>{t(`All ${config.title.toLowerCase()}`)}</h2><span>{language === "zh" ? `MySQL 中的 ${rows.length} 条记录` : `${rows.length} records from MySQL`}</span></div><div className="filters"><Input allowClear prefix={<SearchOutlined />} placeholder={t(`Search ${config.title.toLowerCase()}`)} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><Select value={clusterId} onChange={(value) => { setClusterId(value); setPage(1); }} options={clusterOptions} /></div></div>
      <div className="resource-table-wrap"><table className="resource-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>{visibleRows.map((item) => <tr key={item.id} onClick={() => item.clusterId && navigate(`/clusters/${item.clusterId}`)}>{config.columns.map(([label, render]) => <td key={label}>{render(item, t)}</td>)}</tr>)}</tbody></table>{!rows.length && !isFetching && <div className="empty-state"><SearchOutlined /><b>{t("No records found")}</b><span>{t("Try changing the search or cluster filter.")}</span></div>}</div>
      {!!rows.length && <div className="table-pagination"><Pagination current={page} pageSize={pageSize} total={rows.length} showSizeChanger pageSizeOptions={["20", "50", "100"]} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} /></div>}
    </section>}
  </div>;
}

function ResourceHeading({ title, description, loading, action = null }) {
  return <div className="page-heading overview-heading resource-heading"><div><div className="title-with-source"><h1>{title}</h1><DataSourceTag meta={{ source: loading ? "loading" : "live" }} fetching={loading} /></div><p>{description}</p></div>{action}</div>;
}

function PermissionBoundary({ permission, children }) {
  const { can, roleDefinition } = usePermissions();
  const { t } = useI18n();
  const navigate = useNavigate();
  if (can(permission)) return children;
  return <div className="page access-denied-page"><section className="panel access-denied"><span className="access-denied-icon"><LockOutlined /></span><h1>{t("You do not have access to this page")}</h1><p>{t("Ask an organization owner or system administrator if you need access.")}</p><Tag color="blue">{t("Current role")}: {t(roleDefinition.label)}</Tag><Button type="primary" onClick={() => navigate("/overview")}>{t("Return to overview")}</Button></section></div>;
}

function LoginPage() {
  const { language, t, toggleLanguage } = useI18n();
  const { authenticated, login } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (authenticated) return <Navigate to={location.state?.from || "/overview"} replace />;
  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(username.trim(), password);
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("Invalid username or password."));
    } finally {
      setSubmitting(false);
    }
  };
  return <div className="login-page">
    <header className="login-header"><img src={eventMeshLogo} alt="EventMesh" /><Button className="language-toggle" icon={<GlobalOutlined />} onClick={toggleLanguage}>{language === "en" ? "中" : "EN"}</Button></header>
    <main className="login-main"><section className="login-intro"><Tag color="blue">EVENTMESH DASHBOARD</Tag><h1>{t("Operate EventMesh with clarity and control.")}</h1><p>{t("A production console for clusters, runtimes, topics, consumer groups, connections, and auditable operations.")}</p><div className="login-points"><span><CheckCircleFilled />{t("Organization-isolated access")}</span><span><CheckCircleFilled />{t("Four-role authorization")}</span><span><CheckCircleFilled />{t("MySQL-backed operational data")}</span></div></section>
      <form className="login-card" onSubmit={submit}><span className="login-card-icon"><SafetyCertificateOutlined /></span><h2>{t("Sign in")}</h2><p>{t("Use your EventMesh Dashboard account.")}</p>{error && <Alert type="error" showIcon message={error} />}<label>{t("Username")}<Input autoFocus prefix={<UserOutlined />} autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} /></label><label>{t("Password")}<Input.Password autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><Button type="primary" htmlType="submit" loading={submitting} disabled={!username.trim() || !password}>{t("Sign in")}</Button><small>{t("Access is governed by your active organization role.")}</small></form>
    </main>
  </div>;
}

function MembersPage() {
  const { language, t } = useI18n();
  const { currentOrganizationId, currentRole, user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "ORGANIZATION_MEMBER" });
  const { data: members = [], error, isFetching, refetch } = useQuery({
    queryKey: ["organization", currentOrganizationId, "members"],
    queryFn: () => apiClient.get(`/organizations/${currentOrganizationId}/members`).then(({ data }) => unwrapPayload(data)),
    enabled: Boolean(currentOrganizationId),
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["organization", currentOrganizationId, "members"] });
  const createMutation = useMutation({ mutationFn: () => apiClient.post(`/organizations/${currentOrganizationId}/members`, form), onSuccess: async () => { await invalidate(); setCreateOpen(false); setForm({ username: "", displayName: "", password: "", role: "ORGANIZATION_MEMBER" }); } });
  const updateMutation = useMutation({ mutationFn: ({ userId, role }) => apiClient.patch(`/organizations/${currentOrganizationId}/members/${userId}`, { role }), onSuccess: invalidate });
  const removeMutation = useMutation({ mutationFn: (userId) => apiClient.delete(`/organizations/${currentOrganizationId}/members/${userId}`), onSuccess: invalidate });
  const assignableRoles = currentRole === "SYSTEM_ADMIN" ? ROLE_DEFINITIONS : currentRole === "ORGANIZATION_OWNER" ? ROLE_DEFINITIONS.filter((item) => item.key !== "SYSTEM_ADMIN") : ROLE_DEFINITIONS.filter((item) => item.key === "ORGANIZATION_MEMBER");
  return <div className="page resource-page"><ResourceHeading title={t("Organization members")} description={t("Manage user access and roles for the active organization.")} loading={isFetching} action={<div className="heading-actions"><Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button><Button type="primary" icon={<UserOutlined />} onClick={() => setCreateOpen(true)}>{t("Add member")}</Button></div>} />
    {error ? <ApiError error={error} /> : <section className="panel resource-list-panel"><div className="panel-toolbar"><div><h2>{t("Members")}</h2><span>{language === "zh" ? `${members.length} 位成员` : `${members.length} members`}</span></div></div><div className="resource-table-wrap"><table className="resource-table member-table"><thead><tr><th>{t("User")}</th><th>{t("Username")}</th><th>{t("Role")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>{members.map((member) => { const targetSystem = member.role === "SYSTEM_ADMIN"; const editable = currentRole === "SYSTEM_ADMIN" || (currentRole === "ORGANIZATION_OWNER" && !targetSystem) || (currentRole === "ORGANIZATION_ADMIN" && member.role === "ORGANIZATION_MEMBER"); return <tr key={member.id}><td><span className="primary-cell"><span className="member-avatar">{(member.displayName || member.username).slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>#{member.id}</small></span></span></td><td>{member.username}</td><td><Select value={member.role} disabled={!editable || member.id === user?.id} options={assignableRoles.map((role) => ({ value: role.key, label: t(role.label) }))} onChange={(role) => updateMutation.mutate({ userId: member.id, role })} /></td><td><StatusPill value={member.active ? 1 : 0} /></td><td><Button danger disabled={!editable || member.id === user?.id} loading={removeMutation.isPending && removeMutation.variables === member.id} onClick={() => Modal.confirm({ title: t("Remove organization member?"), content: member.displayName, okText: t("Remove"), okButtonProps: { danger: true }, onOk: () => removeMutation.mutateAsync(member.id) })}>{t("Remove")}</Button></td></tr>; })}</tbody></table>{!members.length && <div className="empty-state"><TeamOutlined /><b>{t("No organization members")}</b></div>}</div></section>}
    <Modal title={t("Add member")} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={() => createMutation.mutate()} confirmLoading={createMutation.isPending} okText={t("Add member")} okButtonProps={{ disabled: !form.username.trim() || !form.displayName.trim() || form.password.length < 10 }}><div className="create-cluster-form"><label>{t("Username")}<Input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} /></label><label>{t("Display name")}<Input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} /></label><label>{t("Temporary password")}<Input.Password value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label><label>{t("Role")}<Select value={form.role} options={assignableRoles.map((role) => ({ value: role.key, label: t(role.label) }))} onChange={(role) => setForm((current) => ({ ...current, role }))} /></label>{createMutation.isError && <Alert type="error" showIcon message={createMutation.error?.response?.data?.message || t("Unable to add member.")} />}</div></Modal>
  </div>;
}

function ApiError({ error }) {
  const { t } = useI18n();
  return <section className="panel api-error"><ExclamationCircleFilled /><div><strong>{t("Unable to read MySQL-backed API data")}</strong><span>{error?.message || t("The EventMesh Dashboard API is unavailable.")}</span></div></section>;
}

function StatusPill({ value, kind = "default" }) {
  const { t } = useI18n();
  const normalized = String(value ?? "").toUpperCase();
  const positive = kind === "operation" ? Number(value) === 2 : kind === "connection" ? Number(value) === 1 : ["1", "STABLE", "ONLINE", "RUNNING", "SUCCESS"].includes(normalized);
  const pending = kind === "operation" && Number(value) === 1;
  const label = kind === "operation" ? ({ 1: "Running", 2: "Succeeded", 3: "Failed" }[Number(value)] ?? "Unknown") : kind === "connection" ? (Number(value) === 1 ? "Connected" : "Disconnected") : (typeof value === "number" ? (value === 1 ? "Active" : "Inactive") : value || "Unknown");
  return <span className={`status-pill ${positive ? "positive" : pending ? "pending" : "negative"}`}><i />{t(label)}</span>;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 16);
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatUptime(value, language) {
  if (language !== "zh" || !value) return value;
  return String(value).replace(/(\d+)d/g, "$1天").replace(/(\d+)h/g, "$1小时").replace(/(\d+)m/g, "$1分钟");
}

function ClusterOverview() {
  const { language, t } = useI18n();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", version: "1.11.0", clusterType: "EVENTMESH_JVM_CLUSTER", description: "" });
  const { data: result = clusterListPlaceholder, isPlaceholderData, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard", "clusters"],
    queryFn: () => dashboardRepository.getClusters(),
    placeholderData: clusterListPlaceholder,
  });
  const clusterData = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const filtered = clusterData.filter((cluster) => cluster.name.toLowerCase().includes(query.toLowerCase()) && (status === "all" || cluster.status.toLowerCase() === status));
  const visibleClusters = filtered.slice((page - 1) * 20, page * 20);
  const healthy = clusterData.filter((cluster) => cluster.status === "Healthy").length;
  const runtimeTotal = clusterData.reduce((total, cluster) => total + Number(cluster.runtimes || 0), 0);
  const regionCount = new Set(clusterData.map((cluster) => cluster.region).filter((region) => region && region !== "—")).size;
  const createMutation = useMutation({
    mutationFn: (values) => dashboardRepository.createCluster(values),
    onSuccess: async ({ id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "clusters"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      setCreateOpen(false);
      setCreateForm({ name: "", version: "1.11.0", clusterType: "EVENTMESH_JVM_CLUSTER", description: "" });
      navigate(`/clusters/${id}`);
    },
  });
  const openCreate = () => {
    if (!can(PERMISSIONS.CREATE_CLUSTER)) return;
    createMutation.reset();
    setCreateOpen(true);
  };
  const updateCreateField = (field, value) => setCreateForm((current) => ({ ...current, [field]: value }));
  const submitCreate = () => {
    if (!can(PERMISSIONS.CREATE_CLUSTER) || !createForm.name.trim() || !createForm.version.trim() || !createForm.description.trim()) return;
    createMutation.mutate(createForm);
  };
  const createDisabled = !createForm.name.trim() || !createForm.version.trim() || !createForm.description.trim();
  const canCreateCluster = can(PERMISSIONS.CREATE_CLUSTER);
  return (
    <div className="page overview-page">
      <div className="page-heading overview-heading">
        <div><div className="title-with-source"><h1>{t("Clusters")}</h1><DataSourceTag meta={sourceMeta} fetching={isFetching} /></div><p>{t("Monitor and manage your EventMesh clusters.")}</p></div>
        <Tooltip title={canCreateCluster ? "" : t("You do not have permission to perform this action.")}><span className="permission-button-wrap"><Button type="primary" icon={<CloudServerOutlined />} disabled={!canCreateCluster} onClick={openCreate}>{t("Create cluster")}</Button></span></Tooltip>
      </div>
      <section className="overview-metrics">
        <MetricCard label={t("Total clusters")} value={clusterData.length} note={language === "zh" ? `覆盖 ${regionCount || 0} 个地域` : `Across ${regionCount || 0} regions`} icon={<ClusterOutlined />} />
        <MetricCard label={t("Healthy")} value={healthy} note={healthy === clusterData.length ? t("All checks passing") : language === "zh" ? `${clusterData.length - healthy} 个需要关注` : `${clusterData.length - healthy} need attention`} icon={<CheckCircleFilled />} tone="green" />
        <MetricCard label={t("Runtimes")} value={runtimeTotal} note={t("Discovered instances")} icon={<DatabaseOutlined />} />
        <MetricCard label={t("Regions")} value={regionCount || "—"} note={t(regionCount ? "Configured cluster regions" : "No MySQL metric available")} icon={<GlobalOutlined />} />
      </section>
      {error ? <ApiError error={error} /> : <section className="panel cluster-list-panel">
        <div className="panel-toolbar">
          <div><h2>{t("All clusters")}</h2><span>{language === "zh" ? `${filtered.length} 个集群` : `${filtered.length} clusters`}</span></div>
          <div className="filters">
            <Input allowClear prefix={<SearchOutlined />} placeholder={t("Search clusters")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: "all", label: t("All status") }, { value: "healthy", label: t("Healthy") }, { value: "warning", label: t("Warning") }]} />
            <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>
          </div>
        </div>
        <div className="cluster-table-wrap">
          <table className="cluster-table">
            <thead><tr><th>{t("Cluster")}</th><th>{t("Status")}</th><th>{t("Region")}</th><th>{t("Runtimes")}</th><th>{t("Topics")}</th><th>{t("Description")}</th><th>{t("Version")}</th></tr></thead>
            <tbody>{visibleClusters.map((cluster) => (
              <tr key={cluster.id} onClick={() => navigate(`/clusters/${cluster.id}`)}>
                <td><span className="cluster-name-icon"><ClusterOutlined /></span><span><strong>{cluster.name}</strong><small>{cluster.clusterId}</small></span></td>
                <td><HealthTag status={cluster.status} /></td><td>{cluster.region}</td><td>{cluster.runtimes ?? 0}</td><td>{Number(cluster.topics ?? 0).toLocaleString()}</td>
                <td>{cluster.description || "—"}</td><td>{cluster.version}</td>
              </tr>
            ))}</tbody>
          </table>
          {!filtered.length && <div className="empty-state"><SearchOutlined /><b>{t("No clusters found")}</b><span>{t("Try changing your filters.")}</span></div>}
        </div>
        {!!filtered.length && <div className="table-pagination"><Pagination current={page} pageSize={20} total={filtered.length} showSizeChanger={false} onChange={setPage} /></div>}
      </section>}
      <Modal title={t("Create cluster")} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={submitCreate} okText={t("Create cluster")} confirmLoading={createMutation.isPending} okButtonProps={{ disabled: createDisabled }} destroyOnHidden>
        <div className="create-cluster-form">
          <div className="create-basic-banner"><CloudServerOutlined /><span><strong>{t("Basic information")}</strong><small>{t("Creates a cluster record in the active organization.")}</small></span></div>
          <label>{t("Cluster name")}<Input value={createForm.name} onChange={(event) => updateCreateField("name", event.target.value)} placeholder={language === "zh" ? "例如：dev-eventmesh-north" : "for example, dev-eventmesh-north"} status={createMutation.isError ? "error" : ""} /></label>
          <div className="create-form-grid"><label>{t("Cluster type")}<Select value={createForm.clusterType} onChange={(value) => updateCreateField("clusterType", value)} options={[{ value: "EVENTMESH_JVM_CLUSTER", label: t("EventMesh JVM cluster") }]} /></label><label>{t("Version")}<Input value={createForm.version} onChange={(event) => updateCreateField("version", event.target.value)} /></label></div>
          <label>{t("Description")}<Input.TextArea rows={3} value={createForm.description} onChange={(event) => updateCreateField("description", event.target.value)} placeholder={t("Describe the workload and environment")} /></label>
          {createMutation.isError && <div className="create-error"><ExclamationCircleFilled />{createMutation.error?.message || t("The cluster could not be created.")}</div>}
          <p className="create-note">{t("The basic flow writes the cluster through the documented EventMesh Dashboard API.")}</p>
        </div>
      </Modal>
    </div>
  );
}

function MetricCard({ label, value, note, icon, tone = "blue" }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function HealthTag({ status }) {
  const { t } = useI18n();
  const value = status || "Unknown";
  return <Tag className={`health-tag ${value.toLowerCase()}`}><i />{t(value)}</Tag>;
}

function DataSourceTag({ meta, fetching = false }) {
  const { t } = useI18n();
  const source = fetching ? "loading" : meta?.source ?? "loading";
  const presentation = {
    live: { label: "Live API", color: "green" },
    mixed: { label: "Live API · partial", color: "gold" },
    loading: { label: "Connecting", color: "processing" },
  }[source];
  const title = meta?.fallbackReason || (source === "live" ? "All visible fields are from the EventMesh Dashboard API." : source === "mixed" ? "Available backend fields are live; fields without a database contract are shown as unavailable." : "Connecting to the EventMesh Dashboard API.");
  return <Tooltip title={t(title)}><Tag className="data-source-tag" color={presentation.color} icon={<ApiOutlined spin={source === "loading"} />}>{t(presentation.label)}</Tag></Tooltip>;
}

function ClusterDetail() {
  const { language, t } = useI18n();
  const { can } = usePermissions();
  const { clusterId } = useParams();
  const navigate = useNavigate();
  const placeholder = useMemo(() => clusterDetailPlaceholder(clusterId), [clusterId]);
  const includeOperations = can(PERMISSIONS.VIEW_OPERATIONS);
  const { data: result = placeholder, isPlaceholderData, isFetching, error } = useQuery({
    queryKey: ["dashboard", "cluster", clusterId, includeOperations],
    queryFn: () => dashboardRepository.getClusterDashboard(clusterId, { includeOperations }),
    placeholderData: placeholder,
  });
  const { cluster, runtimes: runtimeData, topicCount, groupCount, connectionCount, recentChanges: changeData } = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const [manageOpen, setManageOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [copied, setCopied] = useState(false);
  if (error) return <div className="page detail-page"><ApiError error={error} /><button className="back-to-list visible" onClick={() => navigate("/clusters")}><span>←</span> {t("Back to clusters")}</button></div>;
  return (
    <div className="page detail-page">
      <section className="cluster-hero">
        <div className="cluster-identity"><h1>{cluster.name}</h1>
          <div className="metadata primary-meta"><HealthTag status={cluster.status} /><DataSourceTag meta={sourceMeta} fetching={isFetching} /><span>{t("Version")}&nbsp; {cluster.version}</span><span>{t("Cluster ID")}&nbsp; {cluster.clusterId} <Tooltip title={t(copied ? "Copied" : "Copy cluster ID")}><CopyOutlined className="copy-icon" onClick={async () => { await navigator.clipboard.writeText(cluster.clusterId); setCopied(true); window.setTimeout(() => setCopied(false), 1_500); }} /></Tooltip></span><span>{t("Uptime")}&nbsp; {formatUptime(cluster.uptime, language)}</span></div>
          <div className="metadata"><span>{t("Created")}&nbsp; {cluster.created}</span><span>{t("Region")}&nbsp; {cluster.region}</span></div>
        </div>
        <div className="cluster-actions"><Button type="primary" onClick={() => setManageOpen(true)}>{t("Resource shortcuts")}</Button></div>
        <div className="health-score"><Progress type="circle" percent={Number.isFinite(cluster.score) ? cluster.score : 0} size={82} strokeWidth={6} strokeColor="#0ca255" format={(percent) => Number.isFinite(cluster.score) ? percent : "—"} /><div><strong>{t("Cluster health score")} <InfoCircleFilled /></strong><span>{t(Number.isFinite(cluster.score) ? "All systems operational" : "Waiting for health data")}</span><small>{t("Last refreshed")}&nbsp; {formatDateTime(sourceMeta.fetchedAt)}</small></div></div>
      </section>
      <section className="panel cluster-resource-snapshot"><div><span>{t("Runtimes")}</span><strong>{runtimeData.length}</strong><small>{t("Registered instances")}</small></div><div><span>{t("Topics")}</span><strong>{Number(topicCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div><div><span>{t("Consumer Groups")}</span><strong>{Number(groupCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div><div><span>{t("Connections")}</span><strong>{connectionCount ?? "—"}</strong><small>{t("Current total")}</small></div></section>
      <section className={`detail-grid ${!includeOperations ? "without-changes" : ""}`}><RuntimePanel runtimes={runtimeData} onView={() => setDrawer("runtimes")} /><TopicGroupPanel topicCount={topicCount} groupCount={groupCount} />{includeOperations && <ChangesPanel changes={changeData} onView={() => setDrawer("changes")} />}</section>
      <Modal title={t("Resource shortcuts")} open={manageOpen} onCancel={() => setManageOpen(false)} footer={<Button type="primary" onClick={() => setManageOpen(false)}>{t("Done")}</Button>}>
        <div className="manage-form"><p>{t("Open a live resource view for")} <strong>{cluster.name}</strong>{language === "zh" ? "。" : "."}</p><div className="manage-links"><Button icon={<AppstoreOutlined />} onClick={() => navigate("/topics")}>{t("Topics")}</Button><Button icon={<LinkOutlined />} onClick={() => navigate("/connections")}>{t("View connections")}</Button>{includeOperations && <Button icon={<ToolOutlined />} onClick={() => navigate("/operations")}>{t("Operation history")}</Button>}</div></div>
      </Modal>
      <Modal title={t(drawer === "runtimes" ? "All runtimes" : "Recent changes")} open={Boolean(drawer)} onCancel={() => setDrawer(null)} footer={<Button onClick={() => setDrawer(null)}>{t("Close")}</Button>} width={720}>{drawer === "runtimes" ? <RuntimeRows runtimes={runtimeData} /> : <div className="modal-change-list">{changeData.map((item) => <ChangeItem key={item.time} item={item} />)}</div>}</Modal>
      <button className="back-to-list" onClick={() => navigate("/clusters")}><span>←</span> {t("Back to clusters")}</button>
    </div>
  );
}

function RuntimePanel({ runtimes, onView }) {
  const { language, t } = useI18n();
  const healthyCount = runtimes.filter((runtime) => runtime.status === "Healthy").length;
  const percent = runtimes.length ? Math.round((healthyCount / runtimes.length) * 100) : 0;
  const allHealthy = runtimes.length > 0 && healthyCount === runtimes.length;
  return <article className="panel runtime-panel"><div className="card-title"><h2>{t("Runtimes")}</h2><button onClick={onView}>{language === "zh" ? `共 ${runtimes.length} 个` : `${runtimes.length} total`} <span>›</span></button></div><div className="runtime-summary"><Progress type="circle" percent={percent} size={66} strokeWidth={6} strokeColor="#0ca255" format={() => healthyCount} /><div><strong>{t(!runtimes.length ? "No runtimes" : allHealthy ? "Healthy" : "Attention needed")}</strong><span>{!runtimes.length ? t("Register or deploy a Runtime to begin") : allHealthy ? t("No issues detected") : language === "zh" ? `${runtimes.length - healthyCount} 个实例异常` : `${runtimes.length - healthyCount} instances abnormal`}</span></div></div><RuntimeRows runtimes={runtimes} /><button className="text-link" onClick={onView}>{t("View all runtimes")}</button></article>;
}

function RuntimeRows({ runtimes }) {
  const { t } = useI18n();
  return <div className="runtime-table"><div className="runtime-row header"><span>{t("Runtime ID")}</span><span>{t("Status")}</span><span>{t("Host")}</span><span>{t("Port")}</span><span>{t("Connections")}</span></div>{runtimes.map((runtime) => <div className="runtime-row" key={runtime.id}><span title={runtime.name}><i className={runtime.status === "Healthy" ? "" : "warning"} />{runtime.name || runtime.id}</span><span className={runtime.status === "Healthy" ? "healthy-text" : "warning-text"}>{t(runtime.status)}</span><span>{runtime.host || "—"}</span><span>{runtime.port || "—"}</span><span>{runtime.connections ?? "—"}</span></div>)}</div>;
}

function TopicGroupPanel({ topicCount, groupCount }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return <article className="panel topic-panel"><div className="card-title"><h2>{t("Topics")} &amp; {t("Consumer Groups")}</h2><button aria-label={t("Open topics")} onClick={() => navigate("/topics")}>›</button></div><div className="topic-stat"><AppstoreOutlined /><div><span>{t("Topics")}</span><strong>{Number(topicCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div></div><div className="topic-stat"><DatabaseOutlined /><div><span>{t("Consumer Groups")}</span><strong>{Number(groupCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div></div></article>;
}

function ChangesPanel({ changes, onView }) {
  const { t } = useI18n();
  return <article className="panel changes-panel"><div className="card-title"><h2>{t("Recent changes")}</h2><button className="text-link" onClick={onView}>{t("View all")}</button></div><div className="change-list">{changes.slice(0, 5).map((item) => <ChangeItem key={item.time} item={item} />)}</div><button className="text-link bottom-link" onClick={onView}>{t("View all changes")}</button></article>;
}

function ChangeItem({ item }) {
  const { t } = useI18n();
  const Icon = item.type === "success" ? CheckCircleFilled : item.type === "warning" ? ExclamationCircleFilled : InfoCircleFilled;
  return <div className={`change-item ${item.type}`}><Icon /><div><strong>{t(item.title)}</strong><span>{t(item.detail)}</span></div><time>{item.time}</time></div>;
}

function ProtectedConsole() {
  const { checking, authenticated } = useAuth();
  const location = useLocation();
  if (checking) return <div className="auth-loading"><Spin size="large" /><span>EventMesh Dashboard</span></div>;
  if (!authenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Shell><Routes><Route path="/overview" element={<OverviewPage />} /><Route path="/clusters" element={<ClusterOverview />} /><Route path="/clusters/:clusterId" element={<ClusterDetail />} /><Route path="/topics" element={<ResourcePage type="topics" />} /><Route path="/groups" element={<ResourcePage type="groups" />} /><Route path="/connections" element={<ResourcePage type="connections" />} /><Route path="/operations" element={<PermissionBoundary permission={PERMISSIONS.VIEW_OPERATIONS}><ResourcePage type="operations" /></PermissionBoundary>} /><Route path="/organization/members" element={<PermissionBoundary permission={PERMISSIONS.MANAGE_MEMBERS}><MembersPage /></PermissionBoundary>} /><Route path="*" element={<Navigate to="/overview" replace />} /></Routes></Shell>;
}

export function App() {
  const { language } = useI18n();
  return <ConfigProvider locale={language === "zh" ? zhCN : enUS} theme={{ token: { colorPrimary: "#1657df", colorText: "#172033", borderRadius: 7, fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif" }, components: { Button: { controlHeight: 38, fontWeight: 600 }, Modal: { titleFontSize: 18 } } }}><BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<ProtectedConsole />} /></Routes></BrowserRouter></ConfigProvider>;
}
