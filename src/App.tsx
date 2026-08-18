import { useEffect, useMemo, useState } from "react";
import {
  ApiOutlined, AppstoreOutlined, CheckCircleFilled, CloudServerOutlined,
  ClusterOutlined, CopyOutlined, DashboardOutlined, DatabaseOutlined,
  DownOutlined, ExclamationCircleFilled, InfoCircleFilled,
  LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  ReloadOutlined, SearchOutlined, TeamOutlined, ToolOutlined, GlobalOutlined, PlusOutlined,
  SettingOutlined,
  BellOutlined, HomeOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  CloseCircleOutlined, QuestionCircleOutlined,
} from "@ant-design/icons";
import { Alert, Button, ConfigProvider, Input, Modal, Pagination, Select, Spin, Tabs, Tag, Tooltip } from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import eventMeshLogo from "./assets/eventmesh-logo.svg";
import eventMeshHeaderLogo from "./assets/eventmesh-header-logo.png";
import { clusterDetailPlaceholder, clusterListPlaceholder, dashboardRepository } from "./api/dashboardRepository.ts";
import { apiClient } from "./api/client.ts";
import { apiConfig } from "./api/config.ts";
import { unwrapPayload } from "./api/contracts.ts";
import { resourceRepository } from "./api/resourceRepository.ts";
import { TopologyExperience } from "./TopologyExperience.tsx";
import { useI18n } from "./i18n.tsx";
import { clusterResourcePath, normalizeClusterView } from "./routes.ts";

const navSections = [
  { key: "resources", label: "Resource management", items: [
    { key: "overview", label: "Overview", icon: DashboardOutlined, path: "/overview" },
    { key: "clusters", label: "Clusters", icon: ClusterOutlined, path: "/clusters" },
    { key: "topics", label: "Topics", icon: AppstoreOutlined, path: "/topics" },
    { key: "groups", label: "Consumer Groups", icon: TeamOutlined, path: "/groups" },
  ] },
  { key: "operations", label: "Operations management", items: [
    { key: "operations", label: "Operations", icon: ToolOutlined, path: "/operations" },
  ] },
];

const navItems = navSections.flatMap((section) => section.items);

function Shell({ children }) {
  const { language, t, toggleLanguage } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const activeKey = location.pathname.split("/").filter(Boolean)[0] || "overview";
  const activeItem = navItems.find((item) => item.key === activeKey) ?? navItems[0];
  const isClusterDetail = activeKey === "clusters" && location.pathname !== "/clusters";
  const detailLabel = decodeURIComponent(location.pathname.split("/").filter(Boolean)[1] || "");
  const submitGlobalSearch = () => {
    const value = globalSearch.trim();
    navigate(value ? `/clusters?search=${encodeURIComponent(value)}` : "/clusters");
  };
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <button className="brand" aria-label={t("EventMesh home")} onClick={() => navigate("/overview")}><img src={eventMeshLogo} alt="EventMesh" /></button>
        <nav className="side-nav" aria-label={t("Primary navigation")}>
          {navSections.map((section) => <section className="nav-section" key={section.key}>
            <span className="nav-section-label">{t(section.label)}</span>
            {section.items.map(({ key, label, icon: Icon, path }) => {
              return <Tooltip key={key} placement="right" title={collapsed ? t(label) : ""}>
                <button className={key === activeKey ? "active" : ""} onClick={() => navigate(path)}>
                  <Icon /><span>{t(label)}</span>
                </button>
              </Tooltip>;
            })}
          </section>)}
        </nav>
        <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}<span>{t(collapsed ? "Expand" : "Collapse")}</span>
        </button>
      </aside>

      <header className="topbar">
        <div className="global-brand">
          <button aria-label={t("EventMesh home")} onClick={() => navigate("/overview")}><img src={eventMeshHeaderLogo} alt="EventMesh" /></button>
          <button className="workbench-link" onClick={() => navigate("/overview")}><HomeOutlined />{t("Workbench")}</button>
          <button className="resource-link" onClick={() => navigate("/clusters")}><ClusterOutlined />{t("All resources")}<DownOutlined /></button>
        </div>
        <div className="global-search"><Input aria-label={t("Global search")} prefix={<SearchOutlined />} placeholder={t("Search clusters, topics or operations")} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onPressEnter={submitGlobalSearch} allowClear /></div>
        <div className="top-actions">
          <span className="global-scope"><GlobalOutlined />{t("Global")}</span>
          <span className="global-scope"><DatabaseOutlined />{t("Organization")} #{apiConfig.organizationId}</span>
          <Tooltip title={t(language === "en" ? "Switch to Chinese" : "Switch to English")}><Button className="language-toggle" icon={<GlobalOutlined />} onClick={toggleLanguage}>{language === "en" ? "中" : "EN"}</Button></Tooltip>
          <Tooltip title={t("Notifications")}><Button className="notification-button" type="text" icon={<BellOutlined />} /></Tooltip>
        </div>
      </header>
      <main className="workspace">
        <div className="workspace-breadcrumb"><button onClick={() => navigate(activeItem.path)}>{t(activeItem.label)}</button>{isClusterDetail && <><span>/</span><strong>{detailLabel}</strong></>}</div>
        {children}
      </main>
      <StatusBar />
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
  const { data, isFetching, error } = useQuery({
    queryKey: ["resources", "overview"],
    queryFn: () => resourceRepository.getOverview(),
  });
  const runtimeCount = data?.resources.reduce((sum, item) => sum + item.runtimes, 0) ?? 0;
  const topicCount = data?.resources.reduce((sum, item) => sum + item.topics, 0) ?? 0;
  const groupCount = data?.resources.reduce((sum, item) => sum + item.groups, 0) ?? 0;
  return (
    <div className="page resource-page dashboard-overview-page">
      <ResourceHeading title={t("Overview")} description={t("Live operational inventory from EventMesh Dashboard and MySQL.")} loading={isFetching} />
      {error ? <ApiError error={error} /> : <>
        {!!data?.warnings?.length && <Alert className="partial-data-alert" type="warning" showIcon message={t("Some cluster data is temporarily unavailable.")} description={t("Available cluster data is still shown below.")} />}
        <OperationalSummary items={[
          { label: t("Clusters"), value: data?.clusters.length ?? 0, note: t("Registered clusters") },
          { label: t("Runtimes"), value: runtimeCount, note: t("Database instances") },
          { label: t("Topics"), value: topicCount, note: t("Database topics") },
          { label: t("Consumer Groups"), value: groupCount, note: t("Database groups") },
        ]} />
        <section className="overview-resource-grid">
          <article className="panel overview-clusters">
            <div className="resource-card-title"><div><h2>{t("Cluster inventory")}</h2><span>{language === "zh" ? `${data?.clusters.length ?? 0} 个集群` : `${data?.clusters.length ?? 0} clusters`}</span></div><button onClick={() => navigate("/clusters")}>{t("View clusters")}</button></div>
            <div className="inventory-list">{data?.resources.map(({ cluster, runtimes, topics, groups }) => <button key={cluster.id} onClick={() => navigate(clusterResourcePath(cluster.name, "overview"))}><span className="cluster-name-icon"><ClusterOutlined /></span><span><strong>{cluster.name}</strong><small>{language === "zh" ? `${runtimes} 个 Runtime · ${topics} 个主题 · ${groups} 个消费组` : `${runtimes} runtimes · ${topics} topics · ${groups} groups`}</small></span><b>›</b></button>)}</div>
          </article>
          <article className="panel overview-operations">
            <div className="resource-card-title"><div><h2>{t("Recent operations")}</h2><span>{t("Stored in operation_log")}</span></div><button onClick={() => navigate("/operations")}>{t("View all")}</button></div>
            <div className="operation-preview">{data?.operations.slice(0, 6).map((item) => <div key={item.id}><StatusPill value={item.state} kind="operation" /><span><strong>{t(item.content)}</strong><small>{item.operationUser} · {formatDateTime(item.createTime)}</small></span></div>)}</div>
          </article>
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
  const [selectedTopic, setSelectedTopic] = useState(null);
  const navigate = useNavigate();
  const { data: result, isFetching, error, refetch } = useQuery<any>({ queryKey: ["resources", type], queryFn: config.loader });
  const rows = (result?.data ?? []).filter((item) => (clusterId === "all" || String(item.clusterId) === clusterId) && config.search(item).toLowerCase().includes(query.toLowerCase()));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const clusterOptions = [{ value: "all", label: t("All clusters") }, ...(result?.clusters ?? []).map((cluster) => ({ value: String(cluster.id), label: cluster.name }))];
  const headingAction = <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>;
  return <div className="page resource-page">
    <ResourceHeading title={t(config.title)} description={t(config.description)} loading={isFetching} action={headingAction} />
    {error ? <ApiError error={error} /> : <><section className="panel resource-list-panel">
      {!!result?.warnings?.length && <Alert className="partial-data-alert" type="warning" showIcon message={t("Some cluster data is temporarily unavailable.")} description={t("Available cluster data is still shown below.")} />}
      <div className="panel-toolbar"><div><h2>{t(`All ${config.title.toLowerCase()}`)}</h2><span>{language === "zh" ? `MySQL 中的 ${rows.length} 条记录` : `${rows.length} records from MySQL`}</span></div><div className="filters"><Input allowClear prefix={<SearchOutlined />} placeholder={t(`Search ${config.title.toLowerCase()}`)} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /><Select value={clusterId} onChange={(value) => { setClusterId(value); setPage(1); }} options={clusterOptions} /></div></div>
      <div className="resource-table-wrap"><table className="resource-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{t(label)}</th>)}</tr></thead><tbody>{visibleRows.map((item) => <tr key={item.id} onClick={() => type === "topics" ? setSelectedTopic(item) : item.clusterId && navigate(clusterResourcePath(item.clusterName || item.clusterId, "overview"))}>{config.columns.map(([label, render]) => <td key={label}>{render(item, t)}</td>)}</tr>)}</tbody></table>{!rows.length && !isFetching && <div className="empty-state"><SearchOutlined /><b>{t("No records found")}</b><span>{t("Try changing the search or cluster filter.")}</span></div>}</div>
      {!!rows.length && <div className="table-pagination"><Pagination current={page} pageSize={pageSize} total={rows.length} showSizeChanger pageSizeOptions={["20", "50", "100"]} onChange={(nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); }} /></div>}
    </section></>}
    <TopicGroupsModal topic={selectedTopic} onClose={() => setSelectedTopic(null)} />
  </div>;
}

function TopicGroupsModal({ topic, onClose }) {
  const { t } = useI18n();
  const { data: groups = [], isFetching, error } = useQuery({
    queryKey: ["topic-groups", topic?.id],
    queryFn: () => dashboardRepository.getGroupsByTopicId(topic.id),
    enabled: Boolean(topic?.id),
  });
  return <Modal title={`${t("Consumer Groups")} · ${topic?.topicName ?? ""}`} open={Boolean(topic)} onCancel={onClose} footer={<Button onClick={onClose}>{t("Close")}</Button>}>
    {error ? <ApiError error={error} /> : <Spin spinning={isFetching}><div className="resource-table-wrap"><table className="resource-table"><thead><tr><th>{t("Group")}</th><th>{t("Role")}</th><th>{t("State")}</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id}><td>{group.name ?? `#${group.id}`}</td><td>{t(Number(group.type) === 0 ? "Consumer" : "Producer")}</td><td><StatusPill value={group.state ?? group.status} /></td></tr>)}</tbody></table>{!groups.length && !isFetching && <div className="empty-state compact"><TeamOutlined /><b>{t("No records found")}</b></div>}</div></Spin>}
  </Modal>;
}

function ResourceHeading({ title, description, loading, action = null }) {
  return <div className="page-heading overview-heading resource-heading"><div><div className="title-with-source"><h1>{title}</h1><DataSourceTag meta={{ source: loading ? "loading" : "live" }} fetching={loading} /></div><p>{description}</p></div>{action}</div>;
}

function ApiError({ error }) {
  const { t } = useI18n();
  return <section className="panel api-error"><ExclamationCircleFilled /><div><strong>{t("Unable to read MySQL-backed API data")}</strong><span>{error?.message || t("The EventMesh Dashboard API is unavailable.")}</span></div></section>;
}

function StatusPill({ value, kind = "default" }) {
  const { t } = useI18n();
  const numericValue = Number(value);
  const normalizedValue = String(value ?? "").trim().toUpperCase();
  const hasNumericValue = value !== null && value !== undefined && value !== "" && Number.isFinite(numericValue);
  const connected = numericValue === 1 || ["CONNECTED", "ONLINE", "ACTIVE"].includes(normalizedValue);
  const disconnected = (hasNumericValue && numericValue !== 1) || ["DISCONNECTED", "OFFLINE", "INACTIVE", "STOPPED"].includes(normalizedValue);
  const tone = kind === "operation"
    ? (numericValue === 2 ? "healthy" : numericValue === 1 ? "warning" : numericValue === 3 ? "error" : semanticStatusTone(value))
    : kind === "connection"
      ? (connected ? "healthy" : disconnected ? "error" : "unknown")
      : semanticStatusTone(value);
  const label = kind === "operation"
    ? ({ 1: "Running", 2: "Succeeded", 3: "Failed" }[numericValue] ?? (value || "Unknown"))
    : kind === "connection"
      ? (connected ? "Connected" : disconnected ? "Disconnected" : "Unknown")
      : (typeof value === "number" ? (value === 1 ? "Active" : value === 0 ? "Inactive" : "Unknown") : value || "Unknown");
  return <span className={`status-pill ${tone}`}><SemanticStatusIcon tone={tone} />{t(label)}</span>;
}

function semanticStatusTone(value) {
  const normalized = String(value ?? "Unknown").toLowerCase();
  if (["healthy", "running", "online", "success", "started", "normal", "active", "connected", "stable", "1", "true"].some((item) => normalized.includes(item))) return "healthy";
  if (["failed", "failure", "error", "abnormal", "critical", "fatal", "offline", "stopped", "inactive", "disconnected", "0", "false"].some((item) => normalized.includes(item))) return "error";
  if (["warning", "warn", "degraded", "unstable", "partial", "delayed"].some((item) => normalized.includes(item))) return "warning";
  return "unknown";
}

function SemanticStatusIcon({ tone }) {
  const Icon = tone === "healthy" ? CheckCircleOutlined : tone === "warning" ? ExclamationCircleOutlined : tone === "error" ? CloseCircleOutlined : QuestionCircleOutlined;
  return <span className={`semantic-status-icon ${tone}`} aria-hidden="true"><Icon /></span>;
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("all");
  const [clusterType, setClusterType] = useState("all");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ parentClusterId: null, name: "", version: "1.12.0", clusterType: "EVENTMESH_JVM_CLUSTER", description: "", firstToWhom: "DASHBOARD", trusteeshipArrangeType: "NOT" });
  const { data: result = clusterListPlaceholder, isPlaceholderData, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard", "clusters"],
    queryFn: () => dashboardRepository.getClusters(),
    placeholderData: clusterListPlaceholder,
  });
  const clusterData = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const filtered = clusterData.filter((cluster) => `${cluster.name} ${cluster.clusterType}`.toLowerCase().includes(query.toLowerCase()) && (status === "all" || semanticStatusTone(cluster.status) === status) && (clusterType === "all" || cluster.clusterType === clusterType));
  const visibleClusters = filtered.slice((page - 1) * 20, page * 20);
  const active = clusterData.filter((cluster) => semanticStatusTone(cluster.status) === "healthy").length;
  const runtimeTotal = clusterData.reduce((total, cluster) => total + Number(cluster.runtimes || 0), 0);
  const regionCount = new Set(clusterData.map((cluster) => cluster.region).filter((region) => region && region !== "—")).size;
  const clusterTypeOptions = [{ value: "all", label: t("All types") }, ...[...new Set(clusterData.map((cluster) => cluster.clusterType).filter(Boolean))].map((value) => ({ value, label: t(clusterTypePresentation(value).label) }))];
  useEffect(() => {
    const searchValue = searchParams.get("search");
    if (searchValue != null) {
      setQuery(searchValue);
      setPage(1);
    }
  }, [searchParams]);
  const createMutation = useMutation<any, Error, any>({
    mutationFn: (values) => dashboardRepository.createCluster(values),
    onSuccess: async ({ id, name }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["dashboard", "clusters"] }),
        queryClient.invalidateQueries({ queryKey: ["resources"] }),
      ]);
      setCreateOpen(false);
      setCreateForm({ parentClusterId: null, name: "", version: "1.12.0", clusterType: "EVENTMESH_JVM_CLUSTER", description: "", firstToWhom: "DASHBOARD", trusteeshipArrangeType: "NOT" });
      navigate(clusterResourcePath(name || id, "overview"));
    },
  });
  const openCreate = () => {
    createMutation.reset();
    setCreateForm((current) => ({ ...current, parentClusterId: current.parentClusterId ?? (Number(clusterData[0]?.backendId ?? clusterData[0]?.id) || null) }));
    setCreateOpen(true);
  };
  const updateCreateField = (field, value) => setCreateForm((current) => ({ ...current, [field]: value }));
  const createDisabled = !createForm.parentClusterId || !createForm.name.trim() || !createForm.version.trim() || !createForm.description.trim();
  const submitCreate = () => {
    if (!createDisabled) createMutation.mutate(createForm);
  };
  return (
    <div className="page overview-page reference-cluster-page">
      <div className="page-heading overview-heading reference-cluster-heading">
        <div><div className="title-with-source"><h1>{t("Clusters")}</h1><DataSourceTag meta={sourceMeta} fetching={isFetching} /></div><p>{t("Monitor and manage your EventMesh clusters.")}</p></div>
        <div className="heading-actions"><Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button><Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{t("Create cluster")}</Button></div>
      </div>
      <OperationalSummary items={[
        { label: t("Total clusters"), value: clusterData.length, note: language === "zh" ? `覆盖 ${regionCount || 0} 个地域` : `Across ${regionCount || 0} regions` },
        { label: t("Active"), value: `${active} / ${clusterData.length}`, note: language === "zh" ? "来自集群注册状态" : "From registered cluster status" },
        { label: t("Runtimes"), value: runtimeTotal, note: t("Discovered instances") },
        { label: t("Regions"), value: regionCount || "—", note: t(regionCount ? "Configured cluster regions" : "No MySQL metric available") },
      ]} />
      {error ? <ApiError error={error} /> : <section className="panel cluster-list-panel">
        <div className="panel-toolbar">
          <div><h2>{t("All clusters")}</h2><span>{language === "zh" ? `${filtered.length} 个集群` : `${filtered.length} clusters`}</span></div>
          <div className="filters">
            <Input allowClear prefix={<SearchOutlined />} placeholder={t("Search clusters")} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
            <Select value={clusterType} onChange={(value) => { setClusterType(value); setPage(1); }} options={clusterTypeOptions} />
            <Select value={status} onChange={(value) => { setStatus(value); setPage(1); }} options={[{ value: "all", label: t("All status") }, { value: "healthy", label: t("Healthy") }, { value: "warning", label: t("Warning") }, { value: "error", label: t("Abnormal") }, { value: "unknown", label: t("Unknown") }]} />
            <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh")}</Button>
          </div>
        </div>
        <div className="resource-table-wrap cluster-table-wrap"><table className="resource-table cluster-table"><thead><tr><th>{t("Cluster name")}</th><th>{t("Cluster type")}</th><th>{t("Version")}</th><th>{t("Architecture")}</th><th>{t("Status")}</th><th>Runtime</th><th>{t("Topics")}</th><th>{t("Region")}</th><th>{t("Management mode")}</th><th>{t("Actions")}</th></tr></thead><tbody>
          {visibleClusters.map((cluster) => {
            const presentation = clusterTypePresentation(cluster.clusterType);
            const openCluster = () => navigate(clusterResourcePath(cluster.name, "overview"));
            return <tr key={cluster.id} tabIndex={0} onClick={openCluster} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCluster(); } }}>
              <td><span className="primary-cell"><span className="cluster-row-icon">{presentation.icon}</span><span><strong>{cluster.name}</strong><small>{cluster.clusterId}</small></span></span></td>
              <td><ClusterTypeBadge type={cluster.clusterType} /></td><td>{cluster.version || "—"}</td><td>{t(clusterArchitectureLabel(cluster.architecture))}</td><td><HealthTag status={cluster.status} /></td><td>{cluster.runtimes ?? 0}</td><td>{Number(cluster.topics ?? 0).toLocaleString()}</td><td>{cluster.region || "—"}</td><td>{t(clusterManagementLabel(cluster.management, cluster.sourceAuthority))}</td>
              <td><Button type="link" onClick={(event) => { event.stopPropagation(); openCluster(); }}>{t("Manage")}</Button></td>
            </tr>;
          })}
        </tbody></table>{!filtered.length && <div className="empty-state"><SearchOutlined /><b>{t("No clusters found")}</b><span>{t("Try changing your filters.")}</span></div>}</div>
        {!!filtered.length && <div className="table-pagination"><Pagination current={page} pageSize={20} total={filtered.length} showSizeChanger={false} onChange={setPage} /></div>}
      </section>}
      <Modal title={t("Create cluster")} open={createOpen} onCancel={() => !createMutation.isPending && setCreateOpen(false)} onOk={submitCreate} okText={t("Create cluster")} confirmLoading={createMutation.isPending} okButtonProps={{ disabled: createDisabled }} destroyOnHidden>
        <div className="create-cluster-form">
          <div className="create-basic-banner"><CloudServerOutlined /><span><strong>{t("Basic information")}</strong><small>{t("Creates a cluster record in the active organization.")}</small></span></div>
          <label>{t("Parent cluster")}<Select value={createForm.parentClusterId} onChange={(value) => updateCreateField("parentClusterId", value)} placeholder={t("Select a parent cluster")} options={clusterData.map((cluster) => ({ value: Number(cluster.backendId ?? cluster.id), label: `${cluster.name} · #${cluster.backendId ?? cluster.id}` }))} /></label>
          <label>{t("Cluster name")}<Input value={createForm.name} onChange={(event) => updateCreateField("name", event.target.value)} placeholder={language === "zh" ? "例如：dev-eventmesh-north" : "for example, dev-eventmesh-north"} status={createMutation.isError ? "error" : ""} maxLength={128} /></label>
          <div className="create-form-grid"><label>{t("Cluster type")}<Select value={createForm.clusterType} onChange={(value) => updateCreateField("clusterType", value)} options={[{ value: "EVENTMESH_JVM_CLUSTER", label: t("EventMesh JVM cluster") }, { value: "EVENTMESH_CLUSTER", label: t("EventMesh logical cluster") }, { value: "STORAGE_ROCKETMQ_CLUSTER", label: t("RocketMQ cluster") }, { value: "STORAGE_KAFKA_CLUSTER", label: t("Kafka cluster") }]} /></label><label>{t("Version")}<Input value={createForm.version} onChange={(event) => updateCreateField("version", event.target.value)} maxLength={32} /></label></div>
          <label>{t("Description")}<Input.TextArea rows={3} value={createForm.description} onChange={(event) => updateCreateField("description", event.target.value)} placeholder={t("Describe the workload and environment")} /></label>
          {createMutation.isError && <Alert type="error" showIcon message={t("The cluster could not be created.")} description={t("The current backend creation handler is incomplete. No cluster record was saved.")} />}
          <p className="create-note">{t("The form submits to the current Dashboard createCluster API. A successful response refreshes the cluster list automatically.")}</p>
        </div>
      </Modal>
    </div>
  );
}

function OperationalSummary({ items, compact = false }) {
  return <section className={`operational-summary ${compact ? "compact" : ""}`} aria-label="Operational summary">{items.map((item, index) => <div className={`${index === 0 ? "primary" : ""} ${item.tone ? `semantic-${item.tone}` : ""}`} key={item.label}><span className="operational-summary-label">{item.tone && <SemanticStatusIcon tone={item.tone} />}{item.label}</span><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</div>)}</section>;
}

function HealthTag({ status }) {
  const { t } = useI18n();
  const tone = semanticStatusTone(status);
  const label = tone === "healthy" ? "Healthy" : tone === "warning" ? "Warning" : tone === "error" ? "Abnormal" : "Unknown";
  return <Tag className={`health-tag ${tone}`}><SemanticStatusIcon tone={tone} />{t(label)}</Tag>;
}

function clusterTypePresentation(type) {
  const normalized = String(type ?? "UNKNOWN").toUpperCase();
  if (normalized.includes("META")) return { label: "Meta cluster", tone: "meta", icon: <CloudServerOutlined /> };
  if (normalized.includes("STORAGE")) return { label: normalized.includes("ROCKETMQ") ? "RocketMQ storage cluster" : normalized.includes("KAFKA") ? "Kafka storage cluster" : "Storage cluster", tone: "storage", icon: <DatabaseOutlined /> };
  if (normalized.includes("EVENTMESH")) return { label: "EventMesh cluster", tone: "eventmesh", icon: <ClusterOutlined /> };
  return { label: "Other cluster", tone: "other", icon: <ClusterOutlined /> };
}

function clusterArchitectureLabel(value) {
  return ({ NOT: "Not configured", MAIN: "Primary", SLAVE: "Replica", MAIN_SLAVE: "Primary / replica", EVENTMESH_ETCD: "EventMesh + Etcd", EVENTMESH_NACOS: "EventMesh + Nacos", ROCKETMQ_MASTER_SLAVE: "RocketMQ 主从", ROCKETMQ_CONTROLLER: "RocketMQ Controller", KAFKA_ZOOKEEPER: "Kafka ZooKeeper", KAFKA_KRAFT: "Kafka KRaft" })[value] ?? value ?? "—";
}

function clusterManagementLabel(value, sourceAuthority) {
  if (value === "MANAGED") return "Fully managed";
  if (value === "ASSISTED") return "Assisted management";
  if (value === "OBSERVED") return "Observed access";
  if (value === "REGISTERED") return "Registered only";
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
    live: { label: "Live API" },
    mixed: { label: "Live API · partial" },
    loading: { label: "Connecting" },
  }[source];
  const title = meta?.fallbackReason || (source === "live" ? "All visible fields are from the EventMesh Dashboard API." : source === "mixed" ? "Available backend fields are live; fields without a database contract are shown as unavailable." : "Connecting to the EventMesh Dashboard API.");
  return <Tooltip title={t(title)}><Tag className={`data-source-tag ${source}`} icon={<ApiOutlined spin={source === "loading"} />}>{t(presentation.label)}</Tag></Tooltip>;
}

function ClusterDetail() {
  const { language, t } = useI18n();
  const { clusterId, view } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const activeView = normalizeClusterView(view, new URLSearchParams(location.search).get("tab"));
  const placeholder = useMemo(() => clusterDetailPlaceholder(clusterId), [clusterId]);
  const { data: result = placeholder, isPlaceholderData, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard", "cluster", clusterId],
    queryFn: () => dashboardRepository.getClusterDashboard(clusterId),
    placeholderData: placeholder,
  });
  const { cluster, runtimes: runtimeData, topics, groups, topicCount, groupCount, recentChanges: changeData, topology, topologyError } = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const [drawer, setDrawer] = useState(null);
  const [selectedRuntimeId, setSelectedRuntimeId] = useState(null);
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
        <div className="cluster-actions"><Button className="share-link-button" icon={<LinkOutlined />} onClick={copyPageLink}>{t(linkCopied ? "Link copied" : "Copy page link")}</Button><Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>{t("Refresh data")}</Button></div>
        <div className="cluster-health-summary"><span className="cluster-health-icon"><DatabaseOutlined /></span><div><strong>{language === "zh" ? "已连接真实后端数据" : "Live backend data connected"}</strong><span>{language === "zh" ? `集群状态：${cluster.status ?? "未知"}` : `Registered status: ${cluster.status ?? "Unknown"}`}</span><small>{t("Last refreshed")}&nbsp; {formatDateTime(sourceMeta.fetchedAt)}</small></div></div>
      </section>
      <Tabs className="cluster-detail-tabs" activeKey={activeView} onChange={changeView} items={[
        { key: "overview", label: t("Resource overview"), children: <><OperationalSummary compact items={[{ label: t("Runtimes"), value: runtimeData.length }, { label: t("Topics"), value: Number(topicCount ?? 0).toLocaleString() }, { label: t("Consumer Groups"), value: Number(groupCount ?? 0).toLocaleString() }, { label: t("Operations"), value: changeData.length }]} /><section className="cluster-workbench-grid"><ClusterStatusOverview cluster={cluster} runtimes={runtimeData} topology={topology} sourceMeta={sourceMeta} /><RuntimePanel runtimes={runtimeData} onViewAll={() => setDrawer("runtimes")} onViewRuntime={(runtime) => setSelectedRuntimeId(runtime.id)} /><ChangesPanel changes={changeData} onView={() => setDrawer("changes")} /></section></> },
        { key: "topology", label: t("Cluster topology"), children: null },
        { key: "configuration", label: t("Configuration"), children: <ClusterConfigPanel cluster={cluster} /> },
      ]} />
      <Modal title={t(drawer === "runtimes" ? "All runtimes" : "Recent changes")} open={Boolean(drawer)} onCancel={() => setDrawer(null)} footer={<Button onClick={() => setDrawer(null)}>{t("Close")}</Button>} width={720}>{drawer === "runtimes" ? <RuntimeRows runtimes={runtimeData} /> : <div className="modal-change-list">{changeData.map((item) => <ChangeItem key={item.time} item={item} />)}</div>}</Modal>
      <RuntimeDetailModal runtimeId={selectedRuntimeId} onClose={() => setSelectedRuntimeId(null)} />
      <button className="back-to-list" onClick={() => navigate("/clusters")}><span>←</span> {t("Back to clusters")}</button>
    </div>
  );
}

function ClusterStatusOverview({ cluster, runtimes, topology, sourceMeta }) {
  const { language, t } = useI18n();
  const runtimeHealthy = runtimes.length > 0 && runtimes.every((runtime) => runtime.status === "Healthy");
  const checks = [
    ["Runtime availability", runtimeHealthy, runtimes.length ? `${runtimes.filter((runtime) => runtime.status === "Healthy").length} / ${runtimes.length}` : t("No runtimes")],
    ["Cluster status", cluster.status === "Healthy", t(cluster.status || "Unknown")],
    ["Topology data", Boolean(topology), topology ? t("Available") : t("Unavailable")],
    ["Operation audit", true, t("Available")],
  ];
  const allHealthy = checks.slice(0, 3).every(([, healthy]) => healthy);
  return <article className="panel cluster-health-overview"><div className="section-title"><div><h2>{language === "zh" ? "资源状态" : "Resource status"}</h2><p>{language === "zh" ? "根据已完成的查询接口汇总，不执行健康检查。" : "Summarized from stable read APIs; no health check is performed."}</p></div></div><div className="health-conclusion"><span>{allHealthy ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}</span><div><strong>{t(allHealthy ? "All baseline checks passed" : "Some checks need attention")}</strong><small>{t("Last refreshed")}&nbsp; {formatDateTime(sourceMeta?.fetchedAt)}</small></div></div><div className="health-check-list">{checks.map(([label, healthy, detail]) => <div key={label}><span>{healthy ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}{t(label)}</span><strong>{detail}</strong></div>)}</div></article>;
}

function RuntimePanel({ runtimes, onViewAll, onViewRuntime }) {
  const { language, t } = useI18n();
  return <article className="panel runtime-panel"><div className="section-title"><div><h2>{t("Runtime list")}</h2><p>{language === "zh" ? `共 ${runtimes.length} 个已注册实例 · 当前接口只读` : `${runtimes.length} registered instances · read-only contract`}</p></div><Button type="text" icon={<ReloadOutlined />} onClick={onViewAll}>{t("View all")}</Button></div><RuntimeRows runtimes={runtimes} onView={onViewRuntime} /></article>;
}

function RuntimeRows({ runtimes, onView = null }) {
  const { t } = useI18n();
  return <div className="resource-table-wrap runtime-table-wrap"><table className="resource-table runtime-table"><thead><tr><th>{t("Runtime ID")}</th><th>{t("Address")}</th><th>{t("Status")}</th><th>{t("Version")}</th><th>{t("Actions")}</th></tr></thead><tbody>{runtimes.map((runtime) => <tr key={runtime.id}><td><strong>{runtime.name || runtime.id}</strong></td><td>{runtime.host ? `${runtime.host}:${runtime.port || "—"}` : "—"}</td><td><span className={`plain-status ${runtime.status === "Healthy" ? "normal" : "attention"}`}>{runtime.status === "Healthy" ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}{t(runtime.status)}</span></td><td>{runtime.version ?? "—"}</td><td>{onView ? <Button type="link" size="small" onClick={() => onView(runtime)}>{t("View")}</Button> : "—"}</td></tr>)}</tbody></table>{!runtimes.length && <div className="empty-state compact"><CloudServerOutlined /><b>{t("No runtimes")}</b></div>}</div>;
}

function RuntimeDetailModal({ runtimeId, onClose }) {
  const { t } = useI18n();
  const { data: runtime, isFetching, error } = useQuery({ queryKey: ["runtime-detail", runtimeId], queryFn: () => dashboardRepository.getRuntimeById(runtimeId), enabled: Boolean(runtimeId) });
  const fields = [["Runtime ID", runtime?.id], ["Name", runtime?.name], ["Cluster type", runtime?.clusterType], ["Version", runtime?.version], ["Address", runtime?.host ? `${runtime.host}:${runtime.port ?? "—"}` : "—"], ["JMX port", runtime?.jmxPort], ["Rack", runtime?.rack], ["Status", runtime?.status ?? runtime?.deployStatusType]];
  return <Modal title={`${t("Runtime")} · ${runtime?.name ?? runtimeId ?? ""}`} open={Boolean(runtimeId)} onCancel={onClose} footer={<Button onClick={onClose}>{t("Close")}</Button>}>
    {error ? <ApiError error={error} /> : <Spin spinning={isFetching}><div className="manage-form">{fields.map(([label, value]) => <p key={label}><strong>{t(label)}</strong><span>{value ?? "—"}</span></p>)}</div></Spin>}
  </Modal>;
}

function TopicGroupPanel({ topicCount, groupCount }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  return <article className="panel topic-panel"><div className="card-title"><h2>{t("Topics")} &amp; {t("Consumer Groups")}</h2><button aria-label={t("Open topics")} onClick={() => navigate("/topics")}>›</button></div><div className="topic-stat"><AppstoreOutlined /><div><span>{t("Topics")}</span><strong>{Number(topicCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div></div><div className="topic-stat"><DatabaseOutlined /><div><span>{t("Consumer Groups")}</span><strong>{Number(groupCount ?? 0).toLocaleString()}</strong><small>{t("Current total")}</small></div></div></article>;
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
    <Alert className="topology-alert" type="info" showIcon title={t("Configuration is read-only")} description={t("The backend update handler currently returns success without applying changes, so editing remains disabled.")} />
    {error ? <ApiError error={error} /> : <div className="resource-table-wrap"><table className="resource-table config-table"><thead><tr><th>{t("Configuration key")}</th><th>{t("Value")}</th><th>{t("Value type")}</th><th>{t("Business type")}</th><th>{t("Version range")}</th><th>{t("Description")}</th></tr></thead><tbody>{filtered.map((config, index) => <tr key={config.id ?? `${config.configName}-${index}`}><td><code>{config.configName ?? "—"}</code></td><td><code>{maskConfigValue(config.configName, config.configValue)}</code></td><td>{config.configValueType ?? "—"}</td><td>{config.businessType ?? config.configType ?? "—"}</td><td>{[config.startVersion, config.endVersion].filter(Boolean).join(" — ") || "—"}</td><td>{config.description ?? "—"}</td></tr>)}</tbody></table>{!filtered.length && !isFetching && <div className="empty-state"><SettingOutlined /><b>{t("No configuration records")}</b><span>{language === "zh" ? "后端数据库未返回该集群的配置记录。" : "The backend database returned no configuration records for this cluster."}</span></div>}</div>}
  </section>;
}

function ChangesPanel({ changes, onView }) {
  const { t } = useI18n();
  return <article className="panel changes-panel"><div className="section-title"><div><h2>{t("Recent changes")}</h2><p>{t("Auditable operations for the selected cluster.")}</p></div><Button type="text" onClick={onView}>{t("View all")} <span>›</span></Button></div><div className="resource-table-wrap"><table className="resource-table recent-changes-table"><thead><tr><th>{t("Updated")}</th><th>{t("Operation")}</th><th>{t("Details")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>{changes.slice(0, 5).map((item) => <tr key={item.time}><td>{item.time}</td><td><strong>{t(item.title)}</strong></td><td>{t(item.detail)}</td><td><span className={`plain-status ${item.type === "warning" ? "attention" : "normal"}`}>{item.type === "warning" ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}{t(item.type === "warning" ? "Needs attention" : "Succeeded")}</span></td><td><Button type="link" size="small" onClick={onView}>{t("View details")}</Button></td></tr>)}</tbody></table></div></article>;
}

function ChangeItem({ item }) {
  const { t } = useI18n();
  const Icon = item.type === "success" ? CheckCircleFilled : item.type === "warning" ? ExclamationCircleFilled : InfoCircleFilled;
  return <div className={`change-item ${item.type}`}><Icon /><div><strong>{t(item.title)}</strong><span>{t(item.detail)}</span></div><time>{item.time}</time></div>;
}

export function App() {
  const { language } = useI18n();
  return <ConfigProvider locale={language === "zh" ? zhCN : enUS} theme={{ token: { colorPrimary: "#225aa0", colorInfo: "#225aa0", colorSuccess: "#2c7568", colorWarning: "#9a5b00", colorError: "#a9433c", colorText: "#203247", colorTextSecondary: "#5f7388", colorBorder: "#d4e1ef", borderRadius: 3, fontFamily: "Arial, 'Helvetica Neue', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif" }, components: { Button: { controlHeight: 36, fontWeight: 500, borderRadius: 2 }, Input: { controlHeight: 36 }, Select: { controlHeight: 36 }, Modal: { titleFontSize: 18 } } }}><BrowserRouter><Shell><Routes><Route path="/overview" element={<OverviewPage />} /><Route path="/clusters" element={<ClusterOverview />} /><Route path="/clusters/:clusterId" element={<ClusterDetail />} /><Route path="/clusters/:clusterId/:view" element={<ClusterDetail />} /><Route path="/topics" element={<ResourcePage type="topics" />} /><Route path="/groups" element={<ResourcePage type="groups" />} /><Route path="/operations" element={<ResourcePage type="operations" />} /><Route path="*" element={<Navigate to="/overview" replace />} /></Routes></Shell></BrowserRouter></ConfigProvider>;
}
