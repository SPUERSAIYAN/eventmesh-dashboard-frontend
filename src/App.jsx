import { useEffect, useMemo, useState } from "react";
import {
  ApiOutlined, AppstoreOutlined, CheckCircleFilled, CloudServerOutlined,
  ClusterOutlined, CopyOutlined, DashboardOutlined, DatabaseOutlined,
  DownOutlined, ExclamationCircleFilled, InfoCircleFilled,
  LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ReloadOutlined, SearchOutlined, TeamOutlined, ToolOutlined, GlobalOutlined,
  CheckOutlined, CloseOutlined, LockOutlined, SafetyCertificateOutlined, LogoutOutlined, UserOutlined,
  MonitorOutlined, SettingOutlined, PlusOutlined, DeleteOutlined, HistoryOutlined,
} from "@ant-design/icons";
import { Alert, Button, ConfigProvider, Dropdown, Input, InputNumber, Modal, Pagination, Progress, Select, Spin, Tabs, Tag, Tooltip } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import eventMeshLogo from "./assets/eventmesh-logo.svg";
import { clusterDetailPlaceholder, clusterListPlaceholder, dashboardRepository } from "./api/dashboardRepository.js";
import { apiClient } from "./api/client.js";
import { unwrapPayload } from "./api/contracts.js";
import { resourceRepository } from "./api/resourceRepository.js";
import { TopologyExperience } from "./TopologyExperience.jsx";
import { useAuth } from "./AuthProvider.jsx";
import { useI18n } from "./i18n.jsx";
import { usePermissions } from "./PermissionProvider.jsx";
import { PERMISSIONS, ROLE_DEFINITIONS, roleCan } from "./permissions.js";
import { clusterResourcePath, normalizeClusterView } from "./routes.js";

const navItems = [
  { key: "overview", label: "Overview", icon: DashboardOutlined, path: "/overview" },
  { key: "clusters", label: "Clusters", icon: ClusterOutlined, path: "/clusters" },
  { key: "topics", label: "Topics", icon: AppstoreOutlined, path: "/topics" },
  { key: "groups", label: "Consumer Groups", icon: TeamOutlined, path: "/groups" },
  { key: "connections", label: "Client Connections", icon: LinkOutlined, path: "/connections" },
  { key: "monitoring", label: "Health Monitoring", icon: MonitorOutlined, path: "/monitoring" },
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
  const detailLabel = decodeURIComponent(location.pathname.split("/").filter(Boolean)[1] || "");
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
  const { data: apiStatus, isError: apiUnavailable } = useQuery({
    queryKey: ["system", "hello"],
    queryFn: () => apiClient.get("/hello").then(({ data }) => unwrapPayload(data)),
  });
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
      <span className={apiUnavailable ? "status-error" : "status-ok"}><i />{t(apiUnavailable ? "Dashboard API unavailable" : apiStatus == null ? "Checking Dashboard API" : "Dashboard API connected")}</span>
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
            <div className="inventory-list">{data?.resources.map(({ cluster, runtimes, topics, groups }) => <button key={cluster.id} onClick={() => navigate(clusterResourcePath(cluster.name, "overview"))}><span className="cluster-name-icon"><ClusterOutlined /></span><span><strong>{cluster.name}</strong><small>{language === "zh" ? `${runtimes} 个 Runtime · ${topics} 个主题 · ${groups} 个消费组` : `${runtimes} runtimes · ${topics} topics · ${groups} groups`}</small></span><b>›</b></button>)}</div>
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
    title: "Client Connections", description: "Client-to-Runtime network sessions from the net_connection table.", loader: () => resourceRepository.getConnections(),
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
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const config = resourceConfig[type];
  const [query, setQuery] = useState("");
  const [clusterId, setClusterId] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [createTopicOpen, setCreateTopicOpen] = useState(false);
  const [topicForm, setTopicForm] = useState({ clusterId: null, name: "", description: "", partitionsNums: 8, replicasNums: 1, saveTime: 604800000, cleanupStrategy: 0 });
  const navigate = useNavigate();
  const { data: result, isFetching, error, refetch } = useQuery({ queryKey: ["resources", type], queryFn: config.loader });
  const rows = (result?.data ?? []).filter((item) => (clusterId === "all" || String(item.clusterId) === clusterId) && config.search(item).toLowerCase().includes(query.toLowerCase()));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const clusterOptions = [{ value: "all", label: t("All clusters") }, ...(result?.clusters ?? []).map((cluster) => ({ value: String(cluster.id), label: cluster.name }))];
  const canManage = can(PERMISSIONS.MANAGE_CLUSTER);
  const createTopicMutation = useMutation({
    mutationFn: (values) => {
      const cluster = result?.clusters.find((item) => String(item.id) === String(values.clusterId));
      return resourceRepository.createTopic({ ...values, clusterType: cluster?.clusterType });
    },
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["resources", "topics"] }), queryClient.invalidateQueries({ queryKey: ["dashboard"] })]);
      setCreateTopicOpen(false);
      setTopicForm({ clusterId: null, name: "", description: "", partitionsNums: 8, replicasNums: 1, saveTime: 604800000, cleanupStrategy: 0 });
    },
  });
  const deleteGroupMutation = useMutation({
    mutationFn: (id) => resourceRepository.deleteGroup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resources", "groups"] }),
  });
  const openTopicCreate = () => {
    createTopicMutation.reset();
    setTopicForm((current) => ({ ...current, clusterId: current.clusterId ?? result?.clusters?.[0]?.id ?? null }));
    setCreateTopicOpen(true);
  };
  const headingAction = <div className="heading-actions"><Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>{type === "topics" && <Tooltip title={canManage ? "" : t("You do not have permission to perform this action.")}><span><Button type="primary" icon={<PlusOutlined />} disabled={!canManage || !result?.clusters?.length} onClick={openTopicCreate}>{t("Create topic")}</Button></span></Tooltip>}</div>;
  return <div className="page resource-page">
    <ResourceHeading title={t(config.title)} description={t(config.description)} loading={isFetching} action={headingAction} />
    {error ? <ApiError error={error} /> : <section className="panel resource-list-panel">
      <div className="panel-toolbar"><div><h2>{t(`All ${config.title.toLowerCase()}`)}</h2><span>{language === "zh" ? `MySQL 中的 ${rows.length} 条记录` : `${rows.length} records from MySQL`}</span></div><div className="filters"><Input allowClear prefix={<SearchOutlined />} placeholder={t(`Search ${config.title.toLowerCase()}`)} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><Select value={clusterId} onChange={(value) => { setClusterId(value); setPage(1); }} options={clusterOptions} /></div></div>
      <div className="resource-table-wrap"><table className="resource-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{t(label)}</th>)}{type === "groups" && <th>{t("Actions")}</th>}</tr></thead><tbody>{visibleRows.map((item) => <tr key={item.id} onClick={() => item.clusterId && navigate(clusterResourcePath(item.clusterName || item.clusterId, "overview"))}>{config.columns.map(([label, render]) => <td key={label}>{render(item, t)}</td>)}{type === "groups" && <td><Tooltip title={canManage ? "" : t("You do not have permission to perform this action.")}><span><Button danger size="small" icon={<DeleteOutlined />} disabled={!canManage} loading={deleteGroupMutation.isPending && deleteGroupMutation.variables === item.id} onClick={(event) => { event.stopPropagation(); Modal.confirm({ title: t("Delete consumer group?"), content: item.name, okText: t("Delete"), cancelText: t("Cancel"), okButtonProps: { danger: true }, onOk: () => deleteGroupMutation.mutateAsync(item.id) }); }}>{t("Delete")}</Button></span></Tooltip></td>}</tr>)}</tbody></table>{!rows.length && !isFetching && <div className="empty-state"><SearchOutlined /><b>{t("No records found")}</b><span>{t("Try changing the search or cluster filter.")}</span></div>}</div>
      {!!rows.length && <div className="table-pagination"><Pagination current={page} pageSize={pageSize} total={rows.length} showSizeChanger pageSizeOptions={["20", "50", "100"]} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} /></div>}
    </section>}
    <Modal title={t("Create topic")} open={createTopicOpen} onCancel={() => setCreateTopicOpen(false)} onOk={() => createTopicMutation.mutate(topicForm)} okText={t("Create topic")} confirmLoading={createTopicMutation.isPending} okButtonProps={{ disabled: !topicForm.clusterId || !topicForm.name.trim() || !topicForm.description.trim() }} destroyOnHidden>
      <div className="create-cluster-form">
        <Alert type="info" showIcon message={t("The topic will be written through the selected cluster's backend operation scope.")} />
        <label>{t("Cluster")}<Select value={topicForm.clusterId == null ? null : String(topicForm.clusterId)} options={(result?.clusters ?? []).map((cluster) => ({ value: String(cluster.id), label: `${cluster.name} · ${cluster.clusterType}` }))} onChange={(value) => setTopicForm((current) => ({ ...current, clusterId: value }))} /></label>
        <label>{t("Topic name")}<Input value={topicForm.name} onChange={(event) => setTopicForm((current) => ({ ...current, name: event.target.value }))} /></label>
        <div className="create-form-grid"><label>{t("Partitions / queues")}<InputNumber min={1} max={10000} value={topicForm.partitionsNums} onChange={(value) => setTopicForm((current) => ({ ...current, partitionsNums: value }))} /></label><label>{t("Replicas")}<InputNumber min={1} max={15} value={topicForm.replicasNums} onChange={(value) => setTopicForm((current) => ({ ...current, replicasNums: value }))} /></label></div>
        <div className="create-form-grid"><label>{t("Retention")}<Select value={topicForm.saveTime} options={[{ value: 86400000, label: t("1 day") }, { value: 604800000, label: t("7 days") }, { value: 2592000000, label: t("30 days") }, { value: -1, label: t("No limit") }]} onChange={(value) => setTopicForm((current) => ({ ...current, saveTime: value }))} /></label><label>{t("Cleanup policy")}<Select value={topicForm.cleanupStrategy} options={[{ value: 0, label: t("Delete expired messages") }, { value: 1, label: t("Compact by key") }]} onChange={(value) => setTopicForm((current) => ({ ...current, cleanupStrategy: value }))} /></label></div>
        <label>{t("Description")}<Input.TextArea rows={3} value={topicForm.description} onChange={(event) => setTopicForm((current) => ({ ...current, description: event.target.value }))} /></label>
        {createTopicMutation.isError && <Alert type="error" showIcon message={createTopicMutation.error?.response?.data?.message || createTopicMutation.error?.message || t("Topic creation failed.")} />}
      </div>
    </Modal>
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
  const [clusterType, setClusterType] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", version: "1.11.0", clusterType: "EVENTMESH_JVM_CLUSTER", description: "", managementMode: "managed", firstToWhom: "DASHBOARD", trusteeshipArrangeType: "SELF" });
  const { data: result = clusterListPlaceholder, isPlaceholderData, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard", "clusters"],
    queryFn: () => dashboardRepository.getClusters(),
    placeholderData: clusterListPlaceholder,
  });
  const clusterData = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const filtered = clusterData.filter((cluster) => `${cluster.name} ${cluster.clusterType}`.toLowerCase().includes(query.toLowerCase()) && (status === "all" || cluster.status.toLowerCase() === status) && (clusterType === "all" || cluster.clusterType === clusterType));
  const visibleClusters = filtered.slice((page - 1) * 20, page * 20);
  const healthy = clusterData.filter((cluster) => cluster.status === "Healthy").length;
  const runtimeTotal = clusterData.reduce((total, cluster) => total + Number(cluster.runtimes || 0), 0);
  const regionCount = new Set(clusterData.map((cluster) => cluster.region).filter((region) => region && region !== "—")).size;
  const clusterTypeOptions = [{ value: "all", label: t("All types") }, ...[...new Set(clusterData.map((cluster) => cluster.clusterType).filter(Boolean))].map((value) => ({ value, label: t(clusterTypePresentation(value).label) }))];
  const createMutation = useMutation({
    mutationFn: (values) => dashboardRepository.createCluster(values),
    onSuccess: async ({ id, name }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "clusters"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      setCreateOpen(false);
      setCreateForm({ name: "", version: "1.11.0", clusterType: "EVENTMESH_JVM_CLUSTER", description: "", managementMode: "managed", firstToWhom: "DASHBOARD", trusteeshipArrangeType: "SELF" });
      navigate(clusterResourcePath(name || id, "overview"));
    },
  });
  const openCreate = () => {
    if (!can(PERMISSIONS.CREATE_CLUSTER)) return;
    createMutation.reset();
    setCreateOpen(true);
  };
  const updateCreateField = (field, value) => setCreateForm((current) => ({ ...current, [field]: value }));
  const updateManagementMode = (managementMode) => {
    const policy = {
      registered: { firstToWhom: "NOT", trusteeshipArrangeType: "NO_TRUSTEESHIP" },
      observed: { firstToWhom: "RUNTIME", trusteeshipArrangeType: "TRUSTEESHIP_FIND_REVERSE" },
      assisted: { firstToWhom: "RUNTIME", trusteeshipArrangeType: "TRUSTEESHIP" },
      managed: { firstToWhom: "DASHBOARD", trusteeshipArrangeType: "SELF" },
    }[managementMode];
    setCreateForm((current) => ({ ...current, managementMode, ...policy }));
  };
  const submitCreate = () => {
    if (!can(PERMISSIONS.CREATE_CLUSTER) || !createForm.name.trim() || !createForm.version.trim() || !createForm.description.trim()) return;
    createMutation.mutate(createForm);
  };
  const createDisabled = !createForm.name.trim() || !createForm.version.trim() || !createForm.description.trim();
  const canCreateCluster = can(PERMISSIONS.CREATE_CLUSTER);
  return (
    <div className="page overview-page reference-cluster-page">
      <div className="page-heading overview-heading reference-cluster-heading">
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
            <Select value={clusterType} onChange={(value) => { setClusterType(value); setPage(1); }} options={clusterTypeOptions} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: "all", label: t("All status") }, { value: "healthy", label: t("Healthy") }, { value: "warning", label: t("Warning") }]} />
            <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>
          </div>
        </div>
        <div className="cluster-card-grid">
          {visibleClusters.map((cluster) => {
            const presentation = clusterTypePresentation(cluster.clusterType);
            const relationshipCount = (cluster.dependencies?.length ?? 0) + (cluster.dependents?.length ?? 0);
            const openCluster = () => navigate(clusterResourcePath(cluster.name, "overview"));
            return <article key={cluster.id} className={`cluster-console-card ${presentation.tone}`} role="button" tabIndex={0} onClick={openCluster} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCluster(); } }}>
              <header>
                <span className="cluster-console-icon">{presentation.icon}</span>
                <span className="cluster-console-title"><strong>{cluster.name}</strong><small>{t(presentation.label)} · {cluster.clusterId}</small></span>
                <HealthTag status={cluster.status} />
              </header>
              <div className="cluster-console-body">
                <span className="cluster-console-description">{cluster.description || t("No MySQL metric available")}</span>
                <span><small>{t("Runtimes")}</small><strong>{cluster.runtimes ?? 0}</strong></span>
                <span><small>{t("Topics")}</small><strong>{Number(cluster.topics ?? 0).toLocaleString()}</strong></span>
                <span><small>{t("Architecture")}</small><strong>{t(clusterArchitectureLabel(cluster.architecture))}</strong></span>
                <span><small>{t("Management mode")}</small><strong>{t(clusterManagementLabel(cluster.management, cluster.sourceAuthority))}</strong></span>
              </div>
              <footer>
                <span><small>{t("Region")}</small><b>{cluster.region || "—"}</b></span>
                <span><small>{t("Version")}</small><b>{cluster.version || "—"}</b></span>
                <span className="cluster-console-topology">{relationshipCount ? (language === "zh" ? `${relationshipCount} 条关系` : `${relationshipCount} relations`) : t("View topology")} <b>→</b></span>
              </footer>
            </article>;
          })}
          {!filtered.length && <div className="empty-state"><SearchOutlined /><b>{t("No clusters found")}</b><span>{t("Try changing your filters.")}</span></div>}
        </div>
        {!!filtered.length && <div className="table-pagination"><Pagination current={page} pageSize={20} total={filtered.length} showSizeChanger={false} onChange={setPage} /></div>}
      </section>}
      <Modal title={t("Create cluster")} open={createOpen} onCancel={() => setCreateOpen(false)} onOk={submitCreate} okText={t("Create cluster")} confirmLoading={createMutation.isPending} okButtonProps={{ disabled: createDisabled }} destroyOnHidden>
        <div className="create-cluster-form">
          <div className="create-basic-banner"><CloudServerOutlined /><span><strong>{t("Basic information")}</strong><small>{t("Creates a cluster record in the active organization.")}</small></span></div>
          <label>{t("Cluster name")}<Input value={createForm.name} onChange={(event) => updateCreateField("name", event.target.value)} placeholder={language === "zh" ? "例如：dev-eventmesh-north" : "for example, dev-eventmesh-north"} status={createMutation.isError ? "error" : ""} /></label>
          <div className="create-form-grid"><label>{t("Cluster type")}<Select value={createForm.clusterType} onChange={(value) => updateCreateField("clusterType", value)} options={[{ value: "EVENTMESH_JVM_CLUSTER", label: t("EventMesh JVM cluster") }, { value: "EVENTMESH_CLUSTER", label: t("EventMesh logical cluster") }, { value: "STORAGE_ROCKETMQ_CLUSTER", label: t("RocketMQ cluster") }, { value: "STORAGE_KAFKA_CLUSTER", label: t("Kafka cluster") }]} /></label><label>{t("Version")}<Input value={createForm.version} onChange={(event) => updateCreateField("version", event.target.value)} /></label></div>
          <label>{t("Management mode")}<Select value={createForm.managementMode} onChange={updateManagementMode} options={[{ value: "registered", label: t("Registered only") }, { value: "observed", label: t("Observed access") }, { value: "assisted", label: t("Assisted management") }, { value: "managed", label: t("Fully managed") }]} /></label>
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

function clusterTypePresentation(type) {
  const normalized = String(type ?? "UNKNOWN").toUpperCase();
  if (normalized.includes("META")) return { label: "Meta cluster", tone: "meta", icon: <CloudServerOutlined /> };
  if (normalized.includes("STORAGE")) return { label: normalized.includes("ROCKETMQ") ? "RocketMQ storage cluster" : normalized.includes("KAFKA") ? "Kafka storage cluster" : "Storage cluster", tone: "storage", icon: <DatabaseOutlined /> };
  if (normalized.includes("EVENTMESH")) return { label: "EventMesh cluster", tone: "eventmesh", icon: <ClusterOutlined /> };
  return { label: "Other cluster", tone: "other", icon: <ClusterOutlined /> };
}

function clusterArchitectureLabel(value) {
  return ({ NOT: "Not configured", MAIN: "Primary", SLAVE: "Replica", MAIN_SLAVE: "Primary / replica" })[value] ?? value ?? "—";
}

function clusterManagementLabel(value, sourceAuthority) {
  if (value === "SELF" || sourceAuthority === "DASHBOARD") return "Fully managed";
  if (value === "TRUSTEESHIP") return "Assisted management";
  if (["TRUSTEESHIP_FIND", "TRUSTEESHIP_FIND_REVERSE"].includes(value) || sourceAuthority === "RUNTIME") return "Observed access";
  if (["NOT", "NO_TRUSTEESHIP"].includes(value) || sourceAuthority === "NOT") return "Registered only";
  return value ?? "—";
}

function ClusterTypeBadge({ type }) {
  const { t } = useI18n();
  const presentation = clusterTypePresentation(type);
  return <Tooltip title={type || t("Unknown")}><Tag className={`cluster-type-badge ${presentation.tone}`} icon={presentation.icon}>{t(presentation.label)}</Tag></Tooltip>;
}

function ClusterTopologySummary({ cluster, onOpen }) {
  const { language, t } = useI18n();
  const dependencies = cluster.dependencies ?? [];
  const dependents = cluster.dependents ?? [];
  if (!cluster.topologyAvailable) return <span className="topology-summary-empty">{t("Unavailable")}</span>;
  if (!dependencies.length && !dependents.length) return <span className="topology-summary-empty">{t("Not linked")}</span>;
  return <button type="button" className="topology-summary" onClick={(event) => { event.stopPropagation(); onOpen(); }} aria-label={`${t("View topology")}: ${cluster.name}`}>
    {!!dependencies.length && <span className="topology-relation-row"><b><LinkOutlined />{language === "zh" ? `依赖 ${dependencies.length} 个集群` : `${t("Depends on")} ${dependencies.length}`}</b><span>{dependencies.slice(0, 2).map((dependency) => { const type = clusterTypePresentation(dependency.clusterType); return <em key={dependency.id} className={`topology-relation-chip ${type.tone}`}>{t(type.label)} · {dependency.name}</em>; })}{dependencies.length > 2 && <em className="topology-relation-more">+{dependencies.length - 2}</em>}</span></span>}
    {!!dependents.length && <span className="topology-relation-row inbound"><b><ClusterOutlined />{language === "zh" ? `被 ${dependents.length} 个集群依赖` : `${t("Depended on by")} ${dependents.length}`}</b><small>{dependents.map((dependent) => dependent.name).join(" · ")}</small></span>}
  </button>;
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
  const { clusterId, view } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = normalizeClusterView(view, new URLSearchParams(location.search).get("tab"));
  const placeholder = useMemo(() => clusterDetailPlaceholder(clusterId), [clusterId]);
  const includeOperations = can(PERMISSIONS.VIEW_OPERATIONS);
  const { data: result = placeholder, isPlaceholderData, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard", "cluster", clusterId, includeOperations],
    queryFn: () => dashboardRepository.getClusterDashboard(clusterId, { includeOperations }),
    placeholderData: placeholder,
  });
  const { cluster, runtimes: runtimeData, topics, groups, connections, topicCount, groupCount, connectionCount, recentChanges: changeData, topology, topologyError } = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const healthScoreAvailable = Number.isFinite(cluster.score);
  const healthScoreHealthy = healthScoreAvailable && cluster.status === "Healthy";
  const [manageOpen, setManageOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  useEffect(() => {
    if (isPlaceholderData || error || !cluster?.name) return;
    const canonicalPath = clusterResourcePath(cluster.name, activeView, new URLSearchParams(location.search));
    if (canonicalPath !== `${location.pathname}${location.search}`) navigate(canonicalPath, { replace: true });
  }, [activeView, cluster?.name, error, isPlaceholderData, location.pathname, location.search, navigate]);
  const changeView = (nextView) => navigate(clusterResourcePath(cluster.name || clusterId, nextView, new URLSearchParams(location.search)));
  const copyPageLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1_500);
  };
  if (error) return <div className="page detail-page"><ApiError error={error} /><button className="back-to-list visible" onClick={() => navigate("/clusters")}><span>←</span> {t("Back to clusters")}</button></div>;
  if (activeView === "topology") return <div className="topology-experience-page"><TopologyExperience
    cluster={cluster}
    topology={topology}
    runtimes={runtimeData}
    topics={topics}
    groups={groups}
    connections={connections}
    error={topologyError}
    loading={isPlaceholderData}
    fetching={isFetching}
    fetchedAt={sourceMeta.fetchedAt}
    onRefresh={() => refetch()}
    onExit={() => navigate(clusterResourcePath(cluster.name || clusterId, "overview"))}
  /></div>;
  return (
    <div className={`page detail-page reference-cluster-detail ${activeView === "topology" ? "topology-focus" : ""}`}>
      <section className="cluster-hero">
        <div className="cluster-identity"><h1>{cluster.name}</h1>
          <div className="metadata primary-meta"><HealthTag status={cluster.status} /><ClusterTypeBadge type={cluster.clusterType} /><DataSourceTag meta={sourceMeta} fetching={isFetching} /><span>{t("Version")}&nbsp; {cluster.version}</span><span>{t("Cluster ID")}&nbsp; {cluster.clusterId} <Tooltip title={t(copied ? "Copied" : "Copy cluster ID")}><CopyOutlined className="copy-icon" onClick={async () => { await navigator.clipboard.writeText(cluster.clusterId); setCopied(true); window.setTimeout(() => setCopied(false), 1_500); }} /></Tooltip></span><span>{t("Uptime")}&nbsp; {formatUptime(cluster.uptime, language)}</span></div>
          <div className="metadata"><span>{t("Created")}&nbsp; {cluster.created}</span><span>{t("Region")}&nbsp; {cluster.region}</span></div>
        </div>
        <div className="cluster-actions"><Button className="share-link-button" icon={<LinkOutlined />} onClick={copyPageLink}>{t(linkCopied ? "Link copied" : "Copy page link")}</Button><Button type="primary" onClick={() => setManageOpen(true)}>{t("Resource shortcuts")}</Button></div>
        <div className={`health-score ${healthScoreAvailable && !healthScoreHealthy ? "warning" : ""}`}><Progress type="circle" percent={healthScoreAvailable ? cluster.score : 0} size={82} strokeWidth={6} strokeColor={healthScoreHealthy ? "#0ca255" : "#eda800"} format={(percent) => healthScoreAvailable ? percent : "—"} /><div><strong>{t("Cluster health score")} <InfoCircleFilled /></strong><span>{t(!healthScoreAvailable ? "Waiting for health data" : healthScoreHealthy ? "All systems operational" : "Attention needed")}</span><small>{t("Last refreshed")}&nbsp; {formatDateTime(sourceMeta.fetchedAt)}</small></div></div>
      </section>
      <Tabs className="cluster-detail-tabs" activeKey={activeView} onChange={changeView} items={[
        { key: "overview", label: t("Resource overview"), children: <><section className="panel cluster-resource-snapshot"><div><span>{t("Runtimes")}</span><strong>{runtimeData.length}</strong><small>{t("Registered instances")}</small></div><div><span>{t("Topics")}</span><strong>{Number(topicCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div><div><span>{t("Consumer Groups")}</span><strong>{Number(groupCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div><div><span>{t("Connections")}</span><strong>{connectionCount ?? "—"}</strong><small>{t("Current total")}</small></div></section><section className={`detail-grid ${!includeOperations ? "without-changes" : ""}`}><RuntimePanel runtimes={runtimeData} onView={() => setDrawer("runtimes")} /><TopicGroupPanel topicCount={topicCount} groupCount={groupCount} />{includeOperations && <ChangesPanel changes={changeData} onView={() => setDrawer("changes")} />}</section></> },
        { key: "topology", label: t("Cluster topology"), children: <TopologyPanel topology={topology} error={topologyError} loading={isPlaceholderData || isFetching} /> },
        { key: "health", label: t("Health"), children: <ClusterHealthPanel cluster={cluster} runtimes={runtimeData} /> },
        { key: "configuration", label: t("Configuration"), children: <ClusterConfigPanel cluster={cluster} /> },
      ]} />
      <Modal title={t("Resource shortcuts")} open={manageOpen} onCancel={() => setManageOpen(false)} footer={<Button type="primary" onClick={() => setManageOpen(false)}>{t("Done")}</Button>}>
        <div className="manage-form"><p>{t("Open a live resource view for")} <strong>{cluster.name}</strong>{language === "zh" ? "。" : "."}</p><div className="manage-links"><Button icon={<AppstoreOutlined />} onClick={() => navigate("/topics")}>{t("Topics")}</Button><Button icon={<LinkOutlined />} onClick={() => navigate("/connections")}>{t("View connections")}</Button>{includeOperations && <Button icon={<ToolOutlined />} onClick={() => navigate("/operations")}>{t("Operation history")}</Button>}</div></div>
      </Modal>
      <Modal title={t(drawer === "runtimes" ? "All runtimes" : "Recent changes")} open={Boolean(drawer)} onCancel={() => setDrawer(null)} footer={<Button onClick={() => setDrawer(null)}>{t("Close")}</Button>} width={720}>{drawer === "runtimes" ? <RuntimeRows runtimes={runtimeData} /> : <div className="modal-change-list">{changeData.map((item) => <ChangeItem key={item.time} item={item} />)}</div>}</Modal>
      <button className="back-to-list" onClick={() => navigate("/clusters")}><span>←</span> {t("Back to clusters")}</button>
    </div>
  );
}

function flattenTopology(node, parent = null, items = []) {
  if (!node) return items;
  items.push({ ...node, parent });
  node.children?.forEach((child) => flattenTopology(child, node, items));
  return items;
}

function topologyTypeLabel(node, t) {
  if (node.kind === "group") return t("Runtime group");
  if (node.kind === "runtime") return t("Runtime instance");
  const labels = {
    EVENTMESH_JVM_CLUSTER: "EventMesh JVM cluster",
    EVENTMESH_JVM_META: "Metadata cluster",
    EVENTMESH_JVM_RUNTIME: "EventMesh Runtime cluster",
    STORAGE_ROCKETMQ_CLUSTER: "RocketMQ storage cluster",
    STORAGE_KAFKA_CLUSTER: "Kafka storage cluster",
  };
  return t(labels[node.clusterType] ?? "Related cluster");
}

function topologyRelationLabel(relation, t) {
  return t({ ROOT: "Topology root", CLUSTER_RELATIONSHIP: "Cluster relationship", DIRECT_RUNTIME_GROUP: "Direct runtimes", DIRECT_RUNTIME: "Direct runtime", RUNTIME_MEMBER: "Runtime member" }[relation] ?? "Cluster relationship");
}

function topologyNodeName(node, t) {
  return node.kind === "group" ? t(node.name) : node.name;
}

function topologyNodeTone(node) {
  if (node.kind === "runtime" || node.kind === "group") return "runtime";
  if (node.clusterType?.includes("META")) return "metadata";
  if (node.clusterType?.includes("STORAGE")) return "storage";
  return "eventmesh";
}

function topologyNodeMatches(node, query, t) {
  const searchText = [
    topologyNodeName(node, t),
    topologyTypeLabel(node, t),
    node.clusterType,
    node.host,
    node.port,
    topologyRelationLabel(node.relation, t),
  ].filter(Boolean).join(" ").toLocaleLowerCase();
  return searchText.includes(query.trim().toLocaleLowerCase());
}

function topologyNodePassesFilters(node, filters, t) {
  const matchesQuery = !filters.query.trim() || topologyNodeMatches(node, filters.query, t);
  const matchesComponent = filters.component === "all" || topologyNodeTone(node) === filters.component;
  const matchesStatus = filters.status === "all" || (filters.status === "healthy" ? node.status === "Healthy" : node.status !== "Healthy");
  return matchesQuery && matchesComponent && matchesStatus;
}

function filterTopology(node, filters, t) {
  if (!node) return null;
  const children = (node.children ?? []).map((child) => filterTopology(child, filters, t)).filter(Boolean);
  return topologyNodePassesFilters(node, filters, t) || children.length ? { ...node, children } : null;
}

function collapsibleTopologyKeys(topology) {
  return flattenTopology(topology).filter((node) => node.children?.length).map((node) => node.key);
}

function TopologyBranch({ node, selectedKey, onSelect, collapsedKeys, onToggle, forceExpanded = false, depth = 1 }) {
  const { language, t } = useI18n();
  const hasChildren = Boolean(node.children?.length);
  const collapsed = hasChildren && collapsedKeys.has(node.key) && !forceExpanded;
  const NodeIcon = node.kind === "runtime" || node.kind === "group" ? CloudServerOutlined : node.clusterType?.includes("STORAGE") ? DatabaseOutlined : ClusterOutlined;
  return <li>
    <div className={`topology-node-wrap ${hasChildren ? "has-children" : "leaf"}`}>
      <button type="button" role="treeitem" aria-level={depth} aria-selected={selectedKey === node.key} aria-expanded={hasChildren ? !collapsed : undefined} className={`topology-node ${topologyNodeTone(node)} ${selectedKey === node.key ? "selected" : ""}`} onClick={() => onSelect(node)}>
        <span className="topology-node-head">
          <span className={`topology-node-icon ${node.kind}`}><NodeIcon /></span>
          <span className="topology-node-copy"><strong>{topologyNodeName(node, t)}</strong><small>{topologyTypeLabel(node, t)}</small></span>
          <span className={`topology-node-state ${node.status === "Healthy" ? "healthy" : "warning"}`}><i />{t(node.status)}</span>
        </span>
        <span className="topology-node-body">
          <span><small>{t("Node ID")}</small><strong>{node.id == null ? "—" : `#${node.id}`}</strong></span>
          <span><small>{t("Endpoint")}</small><strong>{node.host ? `${node.host}:${node.port ?? "—"}` : "—"}</strong></span>
        </span>
        <span className="topology-node-foot"><span>{topologyRelationLabel(node.relation, t)}</span><b>{hasChildren ? (language === "zh" ? `${node.children.length} 个下级` : `${node.children.length} children`) : (language === "zh" ? "查看详情 →" : "View details →")}</b></span>
      </button>
      {hasChildren && <button type="button" className={`topology-collapse ${collapsed ? "collapsed" : ""}`} aria-label={t(collapsed ? "Expand node" : "Collapse node")} title={t(collapsed ? "Expand node" : "Collapse node")} onClick={() => onToggle(node.key)}><DownOutlined /></button>}
    </div>
    {hasChildren && !collapsed && <ul role="group">{node.children.map((child) => <TopologyBranch key={child.key} node={child} selectedKey={selectedKey} onSelect={onSelect} collapsedKeys={collapsedKeys} onToggle={onToggle} forceExpanded={forceExpanded} depth={depth + 1} />)}</ul>}
  </li>;
}

function TopologyPanel({ topology, error, loading }) {
  const { language, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const component = searchParams.get("component") ?? "all";
  const topologyStatus = searchParams.get("status") ?? "all";
  const requestedNodeKey = searchParams.get("node");
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set());
  useEffect(() => {
    setCollapsedKeys(new Set(flattenTopology(topology).filter((node) => node.kind === "group").map((node) => node.key)));
  }, [topology]);
  const nodes = useMemo(() => flattenTopology(topology), [topology]);
  const selected = useMemo(() => nodes.find((node) => node.key === requestedNodeKey) ?? topology, [nodes, requestedNodeKey, topology]);
  const resourceNodes = nodes.filter((node) => node.kind !== "group");
  const topologyFilters = useMemo(() => ({ query, component, status: topologyStatus }), [component, query, topologyStatus]);
  const hasActiveFilter = Boolean(query.trim()) || component !== "all" || topologyStatus !== "all";
  const visibleTopology = useMemo(() => hasActiveFilter ? filterTopology(topology, topologyFilters, t) : topology, [hasActiveFilter, language, t, topology, topologyFilters]);
  const matchingCount = hasActiveFilter ? resourceNodes.filter((node) => topologyNodePassesFilters(node, topologyFilters, t)).length : resourceNodes.length;
  const clusterCount = nodes.filter((node) => node.kind === "cluster").length;
  const runtimeCount = nodes.filter((node) => node.kind === "runtime").length;
  const relationshipCount = nodes.filter((node) => node.relation === "CLUSTER_RELATIONSHIP").length;
  const toggleNode = (key) => setCollapsedKeys((current) => {
    const next = new Set(current);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });
  const updateUrlState = (key, value) => {
    const next = new URLSearchParams(searchParams);
    value ? next.set(key, value) : next.delete(key);
    setSearchParams(next, { replace: true });
  };
  const selectNode = (node) => updateUrlState("node", node.key);
  if (!topology && loading) return <section className="panel topology-loading"><Spin /><span>{t("Loading cluster topology")}</span></section>;
  if (!topology) return <section className="panel topology-loading"><ClusterOutlined /><span>{t("No topology data")}</span></section>;
  return <section className="panel topology-panel">
    <div className="topology-heading"><div><span className="topology-heading-icon"><ClusterOutlined /></span><span><h2>{t("Cluster topology")}</h2><p>{t("Live hierarchy from cluster_relationship and Runtime records.")}</p></span></div><div className="topology-stats"><span><strong>{resourceNodes.length}</strong>{t("Nodes")}</span><span><strong>{clusterCount}</strong>{t("Clusters")}</span><span><strong>{runtimeCount}</strong>{t("Runtimes")}</span><span><strong>{relationshipCount}</strong>{t("Relations")}</span></div></div>
    {error && <Alert className="topology-alert" type="warning" showIcon message={t("Some topology relationships are unavailable.")} description={error} />}
    {!relationshipCount && <Alert className="topology-alert" type="info" showIcon message={t("No related clusters") } description={t("Direct Runtime instances are shown; add cluster_relationship rows to connect child clusters.")} />}
    <div className="topology-levels" aria-label={t("Topology levels")}>
      <span className="active"><b>1</b><em>{t("Root cluster")}</em></span><i />
      <span className={clusterCount > 1 ? "active" : ""}><b>2</b><em>{t("Related clusters")}</em></span><i />
      <span className={runtimeCount ? "active" : ""}><b>3</b><em>{t("Runtime instances")}</em></span>
      <div className="topology-legend"><span className="eventmesh">{t("EventMesh")}</span><span className="metadata">{t("Metadata")}</span><span className="storage">{t("Storage")}</span><span className="runtime">Runtime</span></div>
    </div>
    <div className="topology-toolbar">
      <Input allowClear prefix={<SearchOutlined />} placeholder={t("Search topology nodes")} value={query} onChange={(event) => updateUrlState("q", event.target.value)} />
      <Select className="topology-filter" value={component} onChange={(value) => updateUrlState("component", value === "all" ? null : value)} options={[{ value: "all", label: t("All components") }, { value: "eventmesh", label: "EventMesh" }, { value: "metadata", label: t("Metadata") }, { value: "storage", label: t("Storage") }, { value: "runtime", label: "Runtime" }]} />
      <Select className="topology-filter status-filter" value={topologyStatus} onChange={(value) => updateUrlState("status", value === "all" ? null : value)} options={[{ value: "all", label: t("All status") }, { value: "healthy", label: t("Healthy") }, { value: "warning", label: t("Needs attention") }]} />
      <span>{hasActiveFilter ? (language === "zh" ? `${matchingCount} 个匹配节点` : `${matchingCount} matching nodes`) : (language === "zh" ? `${resourceNodes.length} 个节点` : `${resourceNodes.length} nodes`)}</span>
      <div><Button size="small" onClick={() => setCollapsedKeys(new Set(collapsibleTopologyKeys(topology)))}>{t("Collapse all")}</Button><Button size="small" onClick={() => setCollapsedKeys(new Set())}>{t("Expand all")}</Button></div>
    </div>
    <div className="topology-layout">
      <div className="topology-tree-wrap">{visibleTopology ? <div className="topology-canvas" role="tree" aria-label={t("Cluster topology")}><ul><TopologyBranch node={visibleTopology} selectedKey={selected?.key} onSelect={selectNode} collapsedKeys={collapsedKeys} onToggle={toggleNode} forceExpanded={hasActiveFilter} /></ul></div> : <div className="topology-empty"><SearchOutlined /><strong>{t("No matching topology nodes")}</strong></div>}</div>
      <aside className="topology-inspector">
        <div className="topology-inspector-title"><span className={`topology-node-icon ${selected?.kind} ${selected ? topologyNodeTone(selected) : ""}`}>{selected?.kind === "runtime" || selected?.kind === "group" ? <CloudServerOutlined /> : <ClusterOutlined />}</span><span><small>{t("Node details")}</small><strong>{selected ? topologyNodeName(selected, t) : "—"}</strong></span></div>
        <dl><div><dt>{t("Node type")}</dt><dd>{selected ? topologyTypeLabel(selected, t) : "—"}</dd></div><div><dt>{t("Status")}</dt><dd><span className={`topology-node-state ${selected?.status === "Healthy" ? "healthy" : "warning"}`}><i />{t(selected?.status ?? "Unknown")}</span></dd></div><div><dt>{t("Relationship")}</dt><dd>{selected ? topologyRelationLabel(selected.relation, t) : "—"}</dd></div><div><dt>{t("Parent node")}</dt><dd>{selected?.parentName ?? "—"}</dd></div><div><dt>{t("Node ID")}</dt><dd>{selected?.id == null ? "—" : `#${selected.id}`}</dd></div><div><dt>{t("Version")}</dt><dd>{selected?.version ?? "—"}</dd></div><div><dt>{t("Endpoint")}</dt><dd>{selected?.host ? `${selected.host}:${selected.port ?? "—"}` : "—"}</dd></div><div><dt>{t("Child nodes")}</dt><dd>{selected?.children?.length ?? 0}</dd></div></dl>
        {!!selected?.children?.length && <div className="topology-child-list"><span>{t("Drill down")}</span>{selected.children.map((child) => <button key={child.key} onClick={() => selectNode(child)}><span><strong>{topologyNodeName(child, t)}</strong><small>{topologyTypeLabel(child, t)}</small></span><b>›</b></button>)}</div>}
        <p>{language === "zh" ? "点击拓扑节点可查看主机、端口及上下级连接关系。" : "Select any node to inspect its endpoint and parent-child relationship."}</p>
      </aside>
    </div>
  </section>;
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

function healthStatusPresentation(value) {
  const normalized = String(value ?? "UNKNOWN").toUpperCase();
  const healthy = ["SUCCESS", "PASSED"].includes(normalized);
  const pending = ["ING", "CHECKING"].includes(normalized);
  return { normalized, healthy, pending };
}

function ClusterHealthPanel({ cluster, runtimes }) {
  const { language, t } = useI18n();
  const [target, setTarget] = useState(() => `1:${cluster.backendId ?? cluster.id}`);
  useEffect(() => setTarget(`1:${cluster.backendId ?? cluster.id}`), [cluster.backendId, cluster.id]);
  const [type, instanceId] = target.split(":");
  const { data: checks = [], error, isFetching, refetch } = useQuery({
    queryKey: ["health-history", type, instanceId],
    queryFn: () => resourceRepository.getHealthHistory({ type: Number(type), instanceId: Number(instanceId) }),
    enabled: Number.isFinite(Number(instanceId)) && Number(instanceId) > 0,
  });
  const passed = checks.filter((check) => healthStatusPresentation(check.result).healthy).length;
  const failed = checks.filter((check) => { const status = healthStatusPresentation(check.result); return !status.healthy && !status.pending; }).length;
  const targetOptions = [{ value: `1:${cluster.backendId ?? cluster.id}`, label: `${t("Cluster")} · ${cluster.name}` }, ...runtimes.map((runtime) => ({ value: `2:${runtime.id}`, label: `${t("Runtime")} · ${runtime.name}` }))];
  return <section className="panel operational-panel">
    <div className="operational-heading"><div><span className="topology-heading-icon"><MonitorOutlined /></span><span><h2>{t("Health history")}</h2><p>{t("Database-backed checks for the selected cluster or Runtime during the last 24 hours.")}</p></span></div><div className="operational-actions"><Select value={target} options={targetOptions} onChange={setTarget} /><Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button></div></div>
    {error ? <ApiError error={error} /> : <>
      <div className="health-summary-strip"><div><span>{t("Checks")}</span><strong>{checks.length}</strong></div><div className="success"><span>{t("Passed")}</span><strong>{passed}</strong></div><div className={failed ? "failed" : ""}><span>{t("Failed")}</span><strong>{failed}</strong></div><div><span>{t("Latest check")}</span><strong className="compact-value">{formatDateTime(checks[0]?.finishTime ?? checks[0]?.beginTime)}</strong></div></div>
      <div className="resource-table-wrap"><table className="resource-table health-history-table"><thead><tr><th>{t("Result")}</th><th>{t("Check type")}</th><th>{t("Protocol")}</th><th>{t("Address")}</th><th>{t("Started")}</th><th>{t("Finished")}</th><th>{t("Details")}</th></tr></thead><tbody>{checks.map((check, index) => { const status = healthStatusPresentation(check.result); return <tr key={check.id ?? `${check.beginTime}-${index}`}><td><span className={`status-pill ${status.healthy ? "positive" : status.pending ? "pending" : "negative"}`}><i />{t(status.normalized)}</span></td><td>{check.healthCheckType ?? "—"}</td><td>{check.protocol ?? "—"}</td><td>{check.address ?? "—"}</td><td>{formatDateTime(check.beginTime)}</td><td>{formatDateTime(check.finishTime)}</td><td>{check.resultDesc ?? "—"}</td></tr>; })}</tbody></table>{!checks.length && !isFetching && <div className="empty-state"><HistoryOutlined /><b>{t("No health checks in the selected period")}</b><span>{language === "zh" ? "后端尚未写入该对象最近 24 小时的健康记录。" : "The backend has not stored a check for this target in the last 24 hours."}</span></div>}</div>
    </>}
  </section>;
}

function maskConfigValue(name, value) {
  if (value == null || value === "") return "—";
  return /(password|passwd|secret|token|credential|access.?key|private.?key)/i.test(String(name)) ? "••••••••" : String(value);
}

function ClusterConfigPanel({ cluster }) {
  const { language, t } = useI18n();
  const [query, setQuery] = useState("");
  const { data: configs = [], error, isFetching, refetch } = useQuery({
    queryKey: ["cluster-config", cluster.backendId],
    queryFn: () => resourceRepository.getConfigs({ instanceId: cluster.backendId, instanceType: "CLUSTER" }),
    enabled: Boolean(cluster.backendId),
  });
  const filtered = configs.filter((config) => `${config.configName} ${config.description} ${config.businessType}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel operational-panel">
    <div className="operational-heading"><div><span className="topology-heading-icon"><SettingOutlined /></span><span><h2>{t("Configuration")}</h2><p>{t("Read-only configuration returned by the current backend contract.")}</p></span></div><div className="operational-actions"><Input allowClear prefix={<SearchOutlined />} placeholder={t("Search configuration")} value={query} onChange={(event) => setQuery(event.target.value)} /><Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button></div></div>
    <Alert className="topology-alert" type="info" showIcon message={t("Configuration is read-only")} description={t("The backend update handler currently returns success without applying changes, so editing remains disabled.")} />
    {error ? <ApiError error={error} /> : <div className="resource-table-wrap"><table className="resource-table config-table"><thead><tr><th>{t("Configuration key")}</th><th>{t("Value")}</th><th>{t("Value type")}</th><th>{t("Business type")}</th><th>{t("Version range")}</th><th>{t("Description")}</th></tr></thead><tbody>{filtered.map((config, index) => <tr key={config.id ?? `${config.configName}-${index}`}><td><code>{config.configName ?? "—"}</code></td><td><code>{maskConfigValue(config.configName, config.configValue)}</code></td><td>{config.configValueType ?? "—"}</td><td>{config.businessType ?? config.configType ?? "—"}</td><td>{[config.startVersion, config.endVersion].filter(Boolean).join(" — ") || "—"}</td><td>{config.description ?? "—"}</td></tr>)}</tbody></table>{!filtered.length && !isFetching && <div className="empty-state"><SettingOutlined /><b>{t("No configuration records")}</b><span>{language === "zh" ? "后端数据库未返回该集群的配置记录。" : "The backend database returned no configuration records for this cluster."}</span></div>}</div>}
  </section>;
}

function MonitoringPage() {
  const { language, t } = useI18n();
  const navigate = useNavigate();
  const { data: result = clusterListPlaceholder, isPlaceholderData, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard", "clusters"],
    queryFn: () => dashboardRepository.getClusters(),
    placeholderData: clusterListPlaceholder,
  });
  const clusters = result.data;
  const healthy = clusters.filter((cluster) => cluster.status === "Healthy").length;
  const scored = clusters.filter((cluster) => Number.isFinite(cluster.score));
  const averageScore = scored.length ? Math.round(scored.reduce((sum, cluster) => sum + cluster.score, 0) / scored.length) : null;
  return <div className="page resource-page">
    <ResourceHeading title={t("Health Monitoring")} description={t("Resource health calculated from backend health checks and registered Runtime records.")} loading={isPlaceholderData || isFetching} action={<Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>} />
    <section className="overview-metrics resource-metrics"><MetricCard label={t("Clusters")} value={clusters.length} note={t("Registered clusters")} icon={<ClusterOutlined />} /><MetricCard label={t("Healthy")} value={healthy} note={language === "zh" ? `${clusters.length - healthy} 个需要关注` : `${clusters.length - healthy} need attention`} icon={<CheckCircleFilled />} tone="green" /><MetricCard label={t("Average health score")} value={averageScore == null ? "—" : `${averageScore}%`} note={t(averageScore == null ? "Waiting for health data" : "Based on stored checks")} icon={<MonitorOutlined />} /><MetricCard label={t("Runtimes")} value={clusters.reduce((sum, cluster) => sum + Number(cluster.runtimes ?? 0), 0)} note={t("Discovered instances")} icon={<CloudServerOutlined />} /></section>
    {error ? <ApiError error={error} /> : <section className="panel resource-list-panel"><div className="panel-toolbar"><div><h2>{t("Cluster health")}</h2><span>{language === "zh" ? `${clusters.length} 个受管集群` : `${clusters.length} managed clusters`}</span></div></div><div className="resource-table-wrap"><table className="resource-table monitoring-table"><thead><tr><th>{t("Cluster")}</th><th>{t("Cluster type")}</th><th>{t("Status")}</th><th>{t("Health score")}</th><th>{t("Runtimes")}</th><th>{t("Topics")}</th><th>{t("Actions")}</th></tr></thead><tbody>{clusters.map((cluster) => <tr key={cluster.id} onClick={() => navigate(clusterResourcePath(cluster.name, "health"))}><td><span className="primary-cell"><ClusterOutlined /><span><strong>{cluster.name}</strong><small>{cluster.clusterId}</small></span></span></td><td><ClusterTypeBadge type={cluster.clusterType} /></td><td><HealthTag status={cluster.status} /></td><td>{Number.isFinite(cluster.score) ? `${cluster.score}%` : "—"}</td><td>{cluster.runtimes ?? "—"}</td><td>{cluster.topics ?? "—"}</td><td><Button size="small" icon={<HistoryOutlined />}>{t("View health")}</Button></td></tr>)}</tbody></table>{!clusters.length && !isFetching && <div className="empty-state"><MonitorOutlined /><b>{t("No clusters found")}</b></div>}</div></section>}
  </div>;
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
  if (!authenticated) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  return <Shell><Routes><Route path="/overview" element={<OverviewPage />} /><Route path="/clusters" element={<ClusterOverview />} /><Route path="/clusters/:clusterId" element={<ClusterDetail />} /><Route path="/clusters/:clusterId/:view" element={<ClusterDetail />} /><Route path="/topics" element={<ResourcePage type="topics" />} /><Route path="/groups" element={<ResourcePage type="groups" />} /><Route path="/connections" element={<ResourcePage type="connections" />} /><Route path="/monitoring" element={<MonitoringPage />} /><Route path="/operations" element={<PermissionBoundary permission={PERMISSIONS.VIEW_OPERATIONS}><ResourcePage type="operations" /></PermissionBoundary>} /><Route path="/organization/members" element={<PermissionBoundary permission={PERMISSIONS.MANAGE_MEMBERS}><MembersPage /></PermissionBoundary>} /><Route path="*" element={<Navigate to="/overview" replace />} /></Routes></Shell>;
}

export function App() {
  const { language } = useI18n();
  return <ConfigProvider locale={language === "zh" ? zhCN : enUS} theme={{ token: { colorPrimary: "#1657df", colorText: "#172033", borderRadius: 7, fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif" }, components: { Button: { controlHeight: 38, fontWeight: 600 }, Modal: { titleFontSize: 18 } } }}><BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<ProtectedConsole />} /></Routes></BrowserRouter></ConfigProvider>;
}
