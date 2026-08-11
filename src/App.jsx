import { useMemo, useState } from "react";
import {
  ApiOutlined, AppstoreOutlined, BellOutlined, CheckCircleFilled, CloudServerOutlined,
  ClusterOutlined, CopyOutlined, DashboardOutlined, DatabaseOutlined,
  DownOutlined, EllipsisOutlined, ExclamationCircleFilled, InfoCircleFilled,
  LinkOutlined, MenuFoldOutlined, MenuUnfoldOutlined, QuestionCircleOutlined,
  ReloadOutlined, SearchOutlined, SwapOutlined, TeamOutlined, ToolOutlined,
} from "@ant-design/icons";
import { Button, ConfigProvider, Input, Modal, Progress, Select, Tag, Tooltip } from "antd";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactECharts from "echarts-for-react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import eventMeshLogo from "./assets/eventmesh-logo.svg";
import { throughputFor } from "./data/dashboard.js";
import { clusterDetailPlaceholder, clusterListPlaceholder, dashboardRepository } from "./api/dashboardRepository.js";
import { resourceRepository } from "./api/resourceRepository.js";

const navItems = [
  { key: "overview", label: "Overview", icon: DashboardOutlined, path: "/overview" },
  { key: "clusters", label: "Clusters", icon: ClusterOutlined, path: "/clusters" },
  { key: "topics", label: "Topics", icon: AppstoreOutlined, path: "/topics" },
  { key: "groups", label: "Consumer Groups", icon: TeamOutlined, path: "/groups" },
  { key: "connections", label: "Connections", icon: LinkOutlined, path: "/connections" },
  { key: "operations", label: "Operations", icon: ToolOutlined, path: "/operations" },
];

function Shell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [notice, setNotice] = useState(0);
  const activeKey = location.pathname.split("/").filter(Boolean)[0] || "overview";
  const activeItem = navItems.find((item) => item.key === activeKey) ?? navItems[0];
  const isClusterDetail = activeKey === "clusters" && location.pathname !== "/clusters";
  const detailLabel = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
  return (
    <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <button className="brand" aria-label="EventMesh home" onClick={() => navigate("/overview")}><img src={eventMeshLogo} alt="EventMesh" /></button>
        <nav className="side-nav" aria-label="Primary navigation">
          {navItems.map(({ key, label, icon: Icon, path }) => (
            <Tooltip key={key} placement="right" title={collapsed ? label : ""}>
              <button className={key === activeKey ? "active" : ""} onClick={() => navigate(path)}>
                <Icon /><span>{label}</span>
              </button>
            </Tooltip>
          ))}
        </nav>
        <button className="collapse-button" onClick={() => setCollapsed((value) => !value)}>
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}<span>Collapse</span>
        </button>
      </aside>

      <header className="topbar">
        <div className="breadcrumb">
          <button onClick={() => navigate(activeItem.path)}>{activeItem.label}</button>
          {isClusterDetail && <><span>/</span><strong>{detailLabel}</strong></>}
        </div>
        <div className="top-actions">
          <Select className="environment-select" defaultValue="production" options={[
            { value: "production", label: <span><small>Environment</small><b>Production</b></span> },
            { value: "staging", label: <span><small>Environment</small><b>Staging</b></span> },
          ]} />
          <Button type="text" shape="circle" icon={<QuestionCircleOutlined />} aria-label="Help" />
          <Button type="text" shape="circle" icon={<BellOutlined />} aria-label="Notifications" onClick={() => setNotice((value) => value + 1)} />
          <span className="avatar">A</span>
        </div>
      </header>
      <main className="workspace">{children}</main>
      <StatusBar />
      <div className={`toast ${notice ? "show" : ""}`} onAnimationEnd={() => setNotice(0)}>This module is coming next.</div>
    </div>
  );
}

function StatusBar() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };
  return (
    <footer className="statusbar">
      <span className="status-ok"><i />All systems operational</span>
      <span className="local-time">Local time&nbsp;&nbsp; 2026-08-11 11:30:45 (UTC-04:00)</span>
      <button onClick={refresh}><ReloadOutlined spin={refreshing} /> Refresh&nbsp; 10s</button><DownOutlined />
    </footer>
  );
}

function OverviewPage() {
  const navigate = useNavigate();
  const { data, isFetching, error } = useQuery({
    queryKey: ["resources", "overview"],
    queryFn: () => resourceRepository.getOverview(),
  });
  const runtimeCount = data?.resources.reduce((sum, item) => sum + item.runtimes, 0) ?? 0;
  const topicCount = data?.resources.reduce((sum, item) => sum + item.topics, 0) ?? 0;
  const groupCount = data?.resources.reduce((sum, item) => sum + item.groups, 0) ?? 0;
  const activeConnections = data?.connections.filter((item) => Number(item.status) === 1).length ?? 0;
  return (
    <div className="page resource-page">
      <ResourceHeading title="Overview" description="Live operational inventory from EventMesh Dashboard and MySQL." loading={isFetching} />
      {error ? <ApiError error={error} /> : <>
        <section className="overview-metrics resource-metrics">
          <MetricCard label="Clusters" value={data?.clusters.length ?? 0} note="Registered clusters" icon={<ClusterOutlined />} />
          <MetricCard label="Runtimes" value={runtimeCount} note="Database instances" icon={<DatabaseOutlined />} />
          <MetricCard label="Topics" value={topicCount} note={`${groupCount} consumer groups`} icon={<AppstoreOutlined />} />
          <MetricCard label="Connections" value={activeConnections} note="Currently connected" icon={<LinkOutlined />} tone="green" />
        </section>
        <section className="overview-resource-grid">
          <article className="panel overview-clusters">
            <div className="resource-card-title"><div><h2>Cluster inventory</h2><span>{data?.clusters.length ?? 0} clusters</span></div><button onClick={() => navigate("/clusters")}>View clusters</button></div>
            <div className="inventory-list">{data?.resources.map(({ cluster, runtimes, topics, groups }) => <button key={cluster.id} onClick={() => navigate(`/clusters/${encodeURIComponent(cluster.name)}`)}><span className="cluster-name-icon"><ClusterOutlined /></span><span><strong>{cluster.name}</strong><small>{runtimes} runtimes · {topics} topics · {groups} groups</small></span><b>›</b></button>)}</div>
          </article>
          <article className="panel overview-operations">
            <div className="resource-card-title"><div><h2>Recent operations</h2><span>Stored in operation_log</span></div><button onClick={() => navigate("/operations")}>View all</button></div>
            <div className="operation-preview">{data?.operations.slice(0, 6).map((item) => <div key={item.id}><StatusPill value={item.state} kind="operation" /><span><strong>{item.content}</strong><small>{item.operationUser} · {formatDateTime(item.createTime)}</small></span></div>)}</div>
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
      ["Cluster", (item) => item.clusterName], ["Role", (item) => Number(item.type) === 0 ? "Consumer" : "Producer"],
      ["State", (item) => <StatusPill value={item.state || item.status} />], ["Owner type", (item) => item.ownType || "—"],
      ["Updated", (item) => formatDateTime(item.updateTime)],
    ],
  },
  connections: {
    title: "Connections", description: "Client-to-Runtime network connections from the net_connection table.", loader: () => resourceRepository.getConnections(),
    search: (item) => `${item.clientHost} ${item.runtimeHost} ${item.clusterName} ${item.description}`,
    columns: [
      ["Client", (item) => <span className="primary-cell"><LinkOutlined /><span><strong>{item.clientHost}:{item.clientPort}</strong><small>Connection #{item.id}</small></span></span>],
      ["Runtime", (item) => `${item.runtimeHost}:${item.runtimePort}`], ["Cluster", (item) => item.clusterName],
      ["Status", (item) => <StatusPill value={item.status} kind="connection" />], ["Connected", (item) => formatDateTime(item.connectionTime)],
      ["Description", (item) => item.description || "—"],
    ],
  },
  operations: {
    title: "Operations", description: "Auditable cluster activity stored in the operation_log table.", loader: () => resourceRepository.getOperations(),
    search: (item) => `${item.content} ${item.clusterName} ${item.operationType} ${item.targetType} ${item.operationUser}`,
    columns: [
      ["Operation", (item) => <span className="primary-cell"><ToolOutlined /><span><strong>{item.content}</strong><small>{item.result}</small></span></span>],
      ["Cluster", (item) => item.clusterName], ["Target", (item) => item.targetType], ["Type", (item) => item.operationType],
      ["User", (item) => item.operationUser], ["State", (item) => <StatusPill value={item.state} kind="operation" />],
      ["Created", (item) => formatDateTime(item.createTime)],
    ],
  },
};

function ResourcePage({ type }) {
  const config = resourceConfig[type];
  const [query, setQuery] = useState("");
  const [clusterId, setClusterId] = useState("all");
  const { data: result, isFetching, error } = useQuery({ queryKey: ["resources", type], queryFn: config.loader });
  const rows = (result?.data ?? []).filter((item) => (clusterId === "all" || String(item.clusterId) === clusterId) && config.search(item).toLowerCase().includes(query.toLowerCase()));
  const clusterOptions = [{ value: "all", label: "All clusters" }, ...(result?.clusters ?? []).map((cluster) => ({ value: String(cluster.id), label: cluster.name }))];
  return <div className="page resource-page">
    <ResourceHeading title={config.title} description={config.description} loading={isFetching} />
    {error ? <ApiError error={error} /> : <section className="panel resource-list-panel">
      <div className="panel-toolbar"><div><h2>All {config.title.toLowerCase()}</h2><span>{rows.length} records from MySQL</span></div><div className="filters"><Input allowClear prefix={<SearchOutlined />} placeholder={`Search ${config.title.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} /><Select value={clusterId} onChange={setClusterId} options={clusterOptions} /></div></div>
      <div className="resource-table-wrap"><table className="resource-table"><thead><tr>{config.columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.id}>{config.columns.map(([label, render]) => <td key={label}>{render(item)}</td>)}</tr>)}</tbody></table>{!rows.length && !isFetching && <div className="empty-state"><SearchOutlined /><b>No records found</b><span>Try changing the search or cluster filter.</span></div>}</div>
    </section>}
  </div>;
}

function ResourceHeading({ title, description, loading }) {
  return <div className="page-heading overview-heading resource-heading"><div><div className="title-with-source"><h1>{title}</h1><DataSourceTag meta={{ source: loading ? "loading" : "live" }} fetching={loading} /></div><p>{description}</p></div></div>;
}

function ApiError({ error }) {
  return <section className="panel api-error"><ExclamationCircleFilled /><div><strong>Unable to read MySQL-backed API data</strong><span>{error?.message || "The EventMesh Dashboard API is unavailable."}</span></div></section>;
}

function StatusPill({ value, kind = "default" }) {
  const normalized = String(value ?? "").toUpperCase();
  const positive = kind === "operation" ? Number(value) === 2 : kind === "connection" ? Number(value) === 1 : ["1", "STABLE", "ONLINE", "RUNNING", "SUCCESS"].includes(normalized);
  const pending = kind === "operation" && Number(value) === 1;
  const label = kind === "operation" ? ({ 1: "Running", 2: "Succeeded", 3: "Failed" }[Number(value)] ?? "Unknown") : kind === "connection" ? (Number(value) === 1 ? "Connected" : "Disconnected") : (typeof value === "number" ? (value === 1 ? "Active" : "Inactive") : value || "Unknown");
  return <span className={`status-pill ${positive ? "positive" : pending ? "pending" : "negative"}`}><i />{label}</span>;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 16);
  return new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function ClusterOverview() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const { data: result = clusterListPlaceholder, isPlaceholderData, isFetching } = useQuery({
    queryKey: ["dashboard", "clusters"],
    queryFn: () => dashboardRepository.getClusters(),
    placeholderData: clusterListPlaceholder,
  });
  const clusterData = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const filtered = clusterData.filter((cluster) => cluster.name.toLowerCase().includes(query.toLowerCase()) && (status === "all" || cluster.status.toLowerCase() === status));
  const healthy = clusterData.filter((cluster) => cluster.status === "Healthy").length;
  const runtimeTotal = clusterData.reduce((total, cluster) => total + Number(cluster.runtimes || 0), 0);
  const rateValues = clusterData.map((cluster) => Number.parseFloat(cluster.inbound)).filter(Number.isFinite);
  const messageRate = rateValues.reduce((total, value) => total + value, 0);
  const regionCount = new Set(clusterData.map((cluster) => cluster.region).filter(Boolean)).size;
  return (
    <div className="page overview-page">
      <div className="page-heading overview-heading">
        <div><div className="title-with-source"><h1>Clusters</h1><DataSourceTag meta={sourceMeta} fetching={isFetching} /></div><p>Monitor and manage your EventMesh clusters.</p></div>
        <Button type="primary" icon={<CloudServerOutlined />}>Create cluster</Button>
      </div>
      <section className="overview-metrics">
        <MetricCard label="Total clusters" value={clusterData.length} note={`Across ${regionCount || 0} regions`} icon={<ClusterOutlined />} />
        <MetricCard label="Healthy" value={healthy} note={healthy === clusterData.length ? "All checks passing" : `${clusterData.length - healthy} need attention`} icon={<CheckCircleFilled />} tone="green" />
        <MetricCard label="Runtimes" value={runtimeTotal} note="Discovered instances" icon={<DatabaseOutlined />} />
        <MetricCard label="Message rate" value={rateValues.length ? `${Math.round(messageRate)}K` : "—"} note={rateValues.length ? "messages / second" : "No MySQL metric available"} icon={<SwapOutlined />} />
      </section>
      <section className="panel cluster-list-panel">
        <div className="panel-toolbar">
          <div><h2>All clusters</h2><span>{filtered.length} clusters</span></div>
          <div className="filters">
            <Input allowClear prefix={<SearchOutlined />} placeholder="Search clusters" value={query} onChange={(event) => setQuery(event.target.value)} />
            <Select value={status} onChange={setStatus} options={[{ value: "all", label: "All status" }, { value: "healthy", label: "Healthy" }, { value: "warning", label: "Warning" }]} />
          </div>
        </div>
        <div className="cluster-table-wrap">
          <table className="cluster-table">
            <thead><tr><th>Cluster</th><th>Status</th><th>Region</th><th>Runtimes</th><th>Topics</th><th>Throughput</th><th>Version</th><th /></tr></thead>
            <tbody>{filtered.map((cluster) => (
              <tr key={cluster.id} onClick={() => navigate(`/clusters/${encodeURIComponent(cluster.name)}`)}>
                <td><span className="cluster-name-icon"><ClusterOutlined /></span><span><strong>{cluster.name}</strong><small>{cluster.clusterId}</small></span></td>
                <td><HealthTag status={cluster.status} /></td><td>{cluster.region}</td><td>{cluster.runtimes}</td><td>{cluster.topics.toLocaleString()}</td>
                <td><strong>{cluster.inbound ?? "—"}</strong>{cluster.inbound && <small> msg/s</small>}</td><td>{cluster.version}</td>
                <td><Button type="text" icon={<EllipsisOutlined />} onClick={(event) => event.stopPropagation()} /></td>
              </tr>
            ))}</tbody>
          </table>
          {!filtered.length && <div className="empty-state"><SearchOutlined /><b>No clusters found</b><span>Try changing your filters.</span></div>}
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, note, icon, tone = "blue" }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>;
}

function HealthTag({ status }) {
  return <Tag className={`health-tag ${status.toLowerCase()}`}><i />{status}</Tag>;
}

function DataSourceTag({ meta, fetching = false }) {
  const source = fetching && meta?.source !== "mock" ? "loading" : meta?.source ?? "mock";
  const presentation = {
    live: { label: "Live API", color: "green" },
    mixed: { label: "Live API · partial", color: "gold" },
    mock: { label: "Demo fallback", color: "default" },
    loading: { label: "Connecting", color: "processing" },
  }[source];
  const title = meta?.fallbackReason || (source === "live" ? "All visible fields are from the EventMesh Dashboard API." : source === "mixed" ? "Available backend fields are live; fields without a database contract are shown as unavailable." : source === "loading" ? "Connecting to the EventMesh Dashboard API." : "The backend is unavailable, so the page is using demo values.");
  return <Tooltip title={title}><Tag className="data-source-tag" color={presentation.color} icon={<ApiOutlined spin={source === "loading"} />}>{presentation.label}</Tag></Tooltip>;
}

function ClusterDetail() {
  const { clusterId } = useParams();
  const navigate = useNavigate();
  const placeholder = useMemo(() => clusterDetailPlaceholder(clusterId), [clusterId]);
  const { data: result = placeholder, isPlaceholderData, isFetching } = useQuery({
    queryKey: ["dashboard", "cluster", clusterId],
    queryFn: () => dashboardRepository.getClusterDashboard(clusterId),
    placeholderData: placeholder,
  });
  const { cluster, runtimes: runtimeData, topicCount, groupCount, recentChanges: changeData } = result.data;
  const sourceMeta = isPlaceholderData ? { ...result.meta, source: "loading" } : result.meta;
  const [range, setRange] = useState("1H");
  const [manageOpen, setManageOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const chartData = useMemo(() => throughputFor(range), [range]);
  const chartOption = useMemo(() => ({
    animationDuration: 450, color: ["#1657df", "#54b8f5"], grid: { left: 46, right: 12, top: 16, bottom: 34 },
    tooltip: { trigger: "axis", backgroundColor: "#0f172a", borderWidth: 0, textStyle: { color: "#fff", fontSize: 12 } }, legend: { show: false },
    xAxis: { type: "category", boundaryGap: false, data: chartData.labels, axisLine: { lineStyle: { color: "#d5dbe6" } }, axisTick: { show: false }, axisLabel: { color: "#667085", fontSize: 11, interval: 7 } },
    yAxis: { type: "value", min: 0, max: 125, interval: 25, axisLabel: { color: "#667085", fontSize: 11, formatter: (value) => value === 0 ? "0" : `${value}K` }, splitLine: { lineStyle: { color: "#dde3ec", type: "dashed" } } },
    series: [
      { name: "Inbound", type: "line", data: chartData.inbound, symbol: "none", lineStyle: { width: 2.2 } },
      { name: "Outbound", type: "line", data: chartData.outbound, symbol: "none", lineStyle: { width: 2.2, type: "dashed" } },
    ],
  }), [chartData]);
  return (
    <div className="page detail-page">
      <section className="cluster-hero">
        <div className="cluster-identity"><h1>{cluster.name}</h1>
          <div className="metadata primary-meta"><HealthTag status={cluster.status} /><DataSourceTag meta={sourceMeta} fetching={isFetching} /><span>Version&nbsp; {cluster.version}</span><span>Cluster ID&nbsp; {cluster.clusterId} <CopyOutlined className="copy-icon" /></span><span>Uptime&nbsp; {cluster.uptime}</span></div>
          <div className="metadata"><span>Created&nbsp; {cluster.created}</span><span>Region&nbsp; {cluster.region}</span></div>
        </div>
        <div className="cluster-actions"><Button type="primary" onClick={() => setManageOpen(true)}>Manage cluster</Button><Button icon={<EllipsisOutlined />} aria-label="More cluster actions" /></div>
        <div className="health-score"><Progress type="circle" percent={cluster.score} size={82} strokeWidth={6} strokeColor="#0ca255" format={(percent) => percent} /><div><strong>Cluster health score <InfoCircleFilled /></strong><span>All systems operational</span><small>Updated&nbsp; 1m ago&nbsp; <ReloadOutlined /></small></div></div>
      </section>
      {cluster.inbound && cluster.outbound ? <section className="panel throughput-panel">
        <div className="chart-heading"><div><h2>Message throughput <InfoCircleFilled /></h2><span>Messages/second</span></div>
          <div className="chart-controls"><span className="legend solid">Inbound</span><span className="legend dashed">Outbound</span><div className="range-control">{["1H", "6H", "24H", "7D", "30D"].map((item) => <button className={range === item ? "active" : ""} onClick={() => setRange(item)} key={item}>{item}</button>)}</div><Button type="text" icon={<AppstoreOutlined />} aria-label="Select date" /></div>
        </div>
        <div className="chart-body"><ReactECharts option={chartOption} className="throughput-chart" notMerge /><aside className="chart-summary"><div><span>Inbound</span><strong>{cluster.inbound}<small> msg/s</small></strong><small>Peak&nbsp; 110.6K</small></div><div><span>Outbound</span><strong>{cluster.outbound}<small> msg/s</small></strong><small>Peak&nbsp; 92.1K</small></div></aside></div>
      </section> : <section className="panel throughput-panel metric-unavailable"><SwapOutlined /><div><h2>Message throughput</h2><p>No MySQL-backed throughput metric is available from the current Controller contracts.</p></div></section>}
      <section className="detail-grid"><RuntimePanel runtimes={runtimeData} onView={() => setDrawer("runtimes")} /><TopicGroupPanel topicCount={topicCount} groupCount={groupCount} /><ChangesPanel changes={changeData} onView={() => setDrawer("changes")} /></section>
      <Modal title="Manage cluster" open={manageOpen} onCancel={() => setManageOpen(false)} onOk={() => setManageOpen(false)} okText="Save changes">
        <div className="manage-form"><label>Cluster name<Input defaultValue={cluster.name} /></label><label>Region<Select defaultValue={cluster.region} options={[{ value: cluster.region, label: cluster.region }, { value: "us-west-2", label: "us-west-2" }]} /></label><label>Automatic health checks<Select defaultValue="enabled" options={[{ value: "enabled", label: "Enabled" }, { value: "disabled", label: "Disabled" }]} /></label></div>
      </Modal>
      <Modal title={drawer === "runtimes" ? "All runtimes" : "Recent changes"} open={Boolean(drawer)} onCancel={() => setDrawer(null)} footer={<Button onClick={() => setDrawer(null)}>Close</Button>} width={720}>{drawer === "runtimes" ? <RuntimeRows runtimes={runtimeData} /> : <div className="modal-change-list">{changeData.map((item) => <ChangeItem key={item.time} item={item} />)}</div>}</Modal>
      <button className="back-to-list" onClick={() => navigate("/clusters")}><span>←</span> Back to clusters</button>
    </div>
  );
}

function RuntimePanel({ runtimes, onView }) {
  const healthyCount = runtimes.filter((runtime) => runtime.status === "Healthy").length;
  const percent = runtimes.length ? Math.round((healthyCount / runtimes.length) * 100) : 0;
  return <article className="panel runtime-panel"><div className="card-title"><h2>Runtimes</h2><button onClick={onView}>{runtimes.length} total <span>›</span></button></div><div className="runtime-summary"><Progress type="circle" percent={percent} size={66} strokeWidth={6} strokeColor="#0ca255" format={() => healthyCount} /><div><strong>{healthyCount === runtimes.length ? "Healthy" : "Attention needed"}</strong><span>{healthyCount === runtimes.length ? "No issues detected" : `${runtimes.length - healthyCount} instances abnormal`}</span></div></div><RuntimeRows runtimes={runtimes} /><button className="text-link" onClick={onView}>View all runtimes</button></article>;
}

function RuntimeRows({ runtimes }) {
  return <div className="runtime-table"><div className="runtime-row header"><span>Runtime ID</span><span>Status</span><span>CPU</span><span>Memory</span><span>Connections</span></div>{runtimes.map((runtime) => <div className="runtime-row" key={runtime.id}><span title={runtime.host ? `${runtime.host}:${runtime.port ?? ""}` : runtime.name}><i className={runtime.status === "Healthy" ? "" : "warning"} />{runtime.name || runtime.id}</span><span className={runtime.status === "Healthy" ? "healthy-text" : "warning-text"}>{runtime.status}</span><span>{runtime.cpu ? <><b style={{ width: runtime.cpu }} />{runtime.cpu}</> : "—"}</span><span>{runtime.memory ? <><b style={{ width: runtime.memory }} />{runtime.memory}</> : "—"}</span><span>{runtime.connections ?? "—"}</span></div>)}</div>;
}

function TopicGroupPanel({ topicCount, groupCount }) {
  return <article className="panel topic-panel"><div className="card-title"><h2>Topics &amp; Consumer Groups</h2><button aria-label="Open topics">›</button></div><div className="topic-stat"><AppstoreOutlined /><div><span>Topics</span><strong>{Number(topicCount).toLocaleString()}</strong><small>Current total</small></div></div><div className="topic-stat"><DatabaseOutlined /><div><span>Consumer Groups</span><strong>{Number(groupCount).toLocaleString()}</strong><small>Current total</small></div></div></article>;
}

function ChangesPanel({ changes, onView }) {
  return <article className="panel changes-panel"><div className="card-title"><h2>Recent changes</h2><button className="text-link" onClick={onView}>View all</button></div><div className="change-list">{changes.map((item) => <ChangeItem key={item.time} item={item} />)}</div><button className="text-link bottom-link" onClick={onView}>View all changes</button></article>;
}

function ChangeItem({ item }) {
  const Icon = item.type === "success" ? CheckCircleFilled : item.type === "warning" ? ExclamationCircleFilled : InfoCircleFilled;
  return <div className={`change-item ${item.type}`}><Icon /><div><strong>{item.title}</strong><span>{item.detail}</span></div><time>{item.time}</time></div>;
}

export function App() {
  return <ConfigProvider theme={{ token: { colorPrimary: "#1657df", colorText: "#172033", borderRadius: 7, fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }, components: { Button: { controlHeight: 38, fontWeight: 600 }, Modal: { titleFontSize: 18 } } }}><BrowserRouter><Shell><Routes><Route path="/overview" element={<OverviewPage />} /><Route path="/clusters" element={<ClusterOverview />} /><Route path="/clusters/:clusterId" element={<ClusterDetail />} /><Route path="/topics" element={<ResourcePage type="topics" />} /><Route path="/groups" element={<ResourcePage type="groups" />} /><Route path="/connections" element={<ResourcePage type="connections" />} /><Route path="/operations" element={<ResourcePage type="operations" />} /><Route path="*" element={<Navigate to="/overview" replace />} /></Routes></Shell></BrowserRouter></ConfigProvider>;
}
