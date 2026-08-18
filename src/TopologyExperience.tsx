import { useEffect, useMemo, useRef, useState } from "react";
import {
  ApartmentOutlined,
  ApiOutlined,
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowRightOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  CloseOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  InfoCircleOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, Select, Spin, Tree } from "antd";
import { useSearchParams } from "react-router-dom";
import eventMeshLogo from "./assets/eventmesh-logo.svg";
import { useI18n } from "./i18n.tsx";
import {
  buildResourceTree,
  filterResourceTree,
  findResourceNode,
  flattenResourceTree,
  resourceTreeExpandedKeys,
} from "./topologyTree.ts";

function normalizedStatus(value) {
  const status = String(value ?? "Unknown").toLowerCase();
  if (["healthy", "running", "online", "success", "started", "normal", "active", "connected", "stable", "1", "true"].some((item) => status.includes(item))) return "healthy";
  if (["failed", "failure", "error", "abnormal", "critical", "fatal", "offline", "stopped", "inactive", "disconnected", "0", "false"].some((item) => status.includes(item))) return "error";
  if (["warning", "warn", "degraded", "unstable", "partial", "delayed"].some((item) => status.includes(item))) return "warning";
  return "unknown";
}

function statusCopy(value, language) {
  const normalized = normalizedStatus(value);
  if (language === "zh") return normalized === "healthy" ? "正常" : normalized === "warning" ? "警告" : normalized === "error" ? "异常" : "未知";
  return normalized === "healthy" ? "Healthy" : normalized === "warning" ? "Warning" : normalized === "error" ? "Abnormal" : "Unknown";
}

function aggregateStatus(nodes) {
  const tones = nodes.map((item) => normalizedStatus(item.status ?? item.raw?.status ?? item.raw?.state));
  if (tones.includes("error")) return "Error";
  if (tones.includes("warning")) return "Warning";
  if (tones.includes("unknown")) return "Unknown";
  return "Healthy";
}

function displayValue(value) {
  return value == null || value === "" ? "—" : String(value);
}

function formatTime(value, language) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).replace("T", " ").slice(0, 19);
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-GB", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(date);
}

function flattenNodes(node, result = []) {
  if (!node) return result;
  result.push(node);
  node.children?.forEach((child) => flattenNodes(child, result));
  return result;
}

function relatedClusterNodes(topology) {
  return (topology?.children ?? []).filter((node) => node.kind === "cluster");
}

function directRuntimeNodes(topology, runtimes) {
  if (runtimes?.length) return runtimes.map((runtime) => ({ ...runtime, key: `runtime-${runtime.id}`, kind: "runtime", nodeType: "RUNTIME" }));
  const group = (topology?.children ?? []).find((node) => node.relation === "DIRECT_RUNTIME_GROUP");
  return group?.children ?? [];
}

function clusterTone(clusterType) {
  const value = String(clusterType ?? "").toUpperCase();
  if (value.includes("KAFKA")) return "purple";
  if (value.includes("ROCKET")) return "orange";
  if (value.includes("PULSAR")) return "blue";
  if (value.includes("META")) return "cyan";
  if (value.includes("STORAGE")) return "indigo";
  return "blue";
}

function clusterNameSuffix(clusterType, language) {
  const value = String(clusterType ?? "").toUpperCase();
  if (value.includes("KAFKA")) return "Kafka";
  if (value.includes("ROCKET")) return "RocketMQ";
  if (value.includes("PULSAR")) return "Pulsar";
  if (value.includes("META")) return language === "zh" ? "元数据" : "Metadata";
  if (value.includes("STORAGE")) return language === "zh" ? "消息存储" : "Event Store";
  return "EventMesh";
}

function iconFor(kind) {
  if (kind === "directory") return <FolderOutlined />;
  if (kind === "topic") return <AppstoreOutlined />;
  if (kind === "group") return <TeamOutlined />;
  if (kind === "runtime") return <CloudServerOutlined />;
  if (kind === "resource") return <ApiOutlined />;
  if (kind === "storage") return <DatabaseOutlined />;
  return <ClusterOutlined />;
}

function resourceKindCopy(node, language) {
  const zh = language === "zh";
  return ({
    cluster: zh ? "集群" : "Cluster",
    runtime: "Runtime",
    topic: "Topic",
    group: zh ? "消费组" : "Consumer group",
    connection: zh ? "连接" : "Connection",
    directory: zh ? "资源目录" : "Resource directory",
  })[node?.kind] ?? displayValue(node?.kind);
}

function relationCopy(relation, language) {
  const zh = language === "zh";
  return ({
    ROOT: zh ? "拓扑根节点" : "Topology root",
    CLUSTER_RELATIONSHIP: zh ? "真实集群依赖" : "Cluster dependency",
    DIRECT_RUNTIME_GROUP: zh ? "直属 Runtime 目录" : "Direct Runtime directory",
    DIRECT_RUNTIME: zh ? "直属 Runtime" : "Direct Runtime",
    RUNTIME_MEMBER: zh ? "集群 Runtime 成员" : "Cluster Runtime member",
    RESOURCE_DIRECTORY: zh ? "资源目录（非拓扑边）" : "Resource directory (not a topology edge)",
    RESOURCE_MEMBERSHIP: zh ? "资源归属（非拓扑边）" : "Resource membership (not a topology edge)",
  })[relation] ?? displayValue(relation);
}

function rowsForNode(node, language) {
  if (!node) return [];
  const zh = language === "zh";
  if (node.kind === "directory") return [
    [zh ? "目录类型" : "Directory type", resourceKindCopy(node, language)],
    [zh ? "关系说明" : "Relationship", relationCopy(node.relation, language)],
    [zh ? "直属项目" : "Direct items", displayValue(node.children?.length)],
    [zh ? "数据说明" : "Data note", zh ? "用于定位资源，不代表后端拓扑边" : "Used for resource discovery; not a backend topology edge"],
  ];
  if (node.kind === "cluster" && node.pathKeys) {
    const realChildren = (node.children ?? []).filter((child) => !child.virtual);
    const runtimeCount = flattenNodes(node, []).filter((child) => child.kind === "runtime").length;
    return [
      [zh ? "节点类型" : "Node type", resourceKindCopy(node, language)],
      [zh ? "关系类型" : "Relationship", relationCopy(node.relation, language)],
      [zh ? "运行状态" : "Status", statusCopy(node.status, language)],
      [zh ? "版本" : "Version", displayValue(node.version)],
      [zh ? "Runtime 数量" : "Runtimes", runtimeCount],
      [zh ? "真实子关系" : "Relationship children", realChildren.length],
      [zh ? "集群 ID" : "Cluster ID", displayValue(node.id)],
      [zh ? "说明" : "Description", displayValue(node.description)],
    ];
  }
  if (node.kind === "runtime") return [
    [zh ? "节点类型" : "Node type", "Runtime"],
    [zh ? "运行状态" : "Status", statusCopy(node.status, language)],
    [zh ? "主机地址" : "Host", displayValue(node.host)],
    [zh ? "服务端口" : "Port", displayValue(node.port)],
    [zh ? "版本" : "Version", displayValue(node.version)],
    [zh ? "节点 ID" : "Node ID", displayValue(node.id)],
  ];
  if (node.kind === "topic") return [
    [zh ? "主题名称" : "Topic", displayValue(node.raw.topicName)],
    [zh ? "主题类型" : "Type", displayValue(node.raw.topicType)],
    [zh ? "读队列" : "Read queues", displayValue(node.raw.readQueueNum)],
    [zh ? "写队列" : "Write queues", displayValue(node.raw.writeQueueNum)],
    [zh ? "状态" : "Status", statusCopy(node.raw.status, language)],
    [zh ? "更新时间" : "Updated", formatTime(node.raw.updateTime, language)],
  ];
  if (node.kind === "group") return [
    [zh ? "组名称" : "Group", displayValue(node.raw.name)],
    [zh ? "角色" : "Role", Number(node.raw.type) === 0 ? (zh ? "消费者" : "Consumer") : (zh ? "生产者" : "Producer")],
    [zh ? "状态" : "State", displayValue(node.raw.state ?? node.raw.status)],
    [zh ? "归属类型" : "Owner type", displayValue(node.raw.ownType)],
    [zh ? "更新时间" : "Updated", formatTime(node.raw.updateTime, language)],
    [zh ? "组 ID" : "Group ID", displayValue(node.raw.id)],
  ];
  return [
    [zh ? "组件类型" : "Component type", displayValue(node.clusterType ?? node.kind)],
    [zh ? "运行状态" : "Status", statusCopy(node.status, language)],
    [zh ? "版本" : "Version", displayValue(node.version)],
    [zh ? "实例数量" : "Instances", displayValue(node.children?.length ?? node.nodes?.length)],
    [zh ? "组件 ID" : "Component ID", displayValue(node.id)],
    [zh ? "说明" : "Description", displayValue(node.description)],
  ];
}

function StatusIcon({ status }) {
  const tone = normalizedStatus(status);
  const Icon = tone === "healthy" ? CheckCircleOutlined : tone === "warning" ? ExclamationCircleOutlined : tone === "error" ? CloseCircleOutlined : QuestionCircleOutlined;
  return <span className={`et-status-icon ${tone}`} aria-hidden="true"><Icon /></span>;
}

function StatusPill({ status, language }) {
  const tone = normalizedStatus(status);
  return <span className={`et-status ${tone}`}><StatusIcon status={status} />{statusCopy(status, language)}</span>;
}

function StatusLegendItem({ status, language }) {
  return <span className={`et-legend-item ${normalizedStatus(status)}`}><StatusIcon status={status} />{statusCopy(status, language)}</span>;
}

function InstanceGlyph({ tone = "blue" }) {
  return <span className={`et-instance-glyph ${tone}`}><i /><i /><i /></span>;
}

function toRuntimeItem(runtime, tone = "blue") {
  return {
    ...runtime,
    key: runtime.key ?? `runtime-${runtime.id}`,
    kind: "runtime",
    title: runtime.name ?? `Runtime-${runtime.id}`,
    subtitle: runtime.host ? `${runtime.host}:${runtime.port ?? "—"}` : displayValue(runtime.version),
    tone,
  };
}

function buildComponents({ cluster, topology, runtimes, topics, groups, language }) {
  const zh = language === "zh";
  const directRuntimes = directRuntimeNodes(topology, runtimes).map((runtime) => toRuntimeItem(runtime, "blue"));
  const related = relatedClusterNodes(topology);
  const dependencies = related.map((node) => {
    const tone = clusterTone(node.clusterType);
    const children = flattenNodes(node).filter((child) => child.kind === "runtime").map((runtime) => toRuntimeItem(runtime, tone));
    return {
      id: `cluster-${node.id}`,
      kind: String(node.clusterType ?? "").toUpperCase().includes("STORAGE") ? "storage" : "cluster",
      title: node.name,
      subtitle: `${clusterNameSuffix(node.clusterType, language)} ${zh ? "集群" : "cluster"}`,
      tone,
      status: node.status,
      clusterType: node.clusterType,
      source: node,
      nodes: children,
      footer: [[zh ? "实例" : "Instances", children.length], [zh ? "版本" : "Version", displayValue(node.version)]],
    };
  });
  const metadata = dependencies.filter((item) => String(item.clusterType ?? "").toUpperCase().includes("META"));
  const stores = dependencies.filter((item) => !String(item.clusterType ?? "").toUpperCase().includes("META"));
  const topicNodes = topics.map((item, index) => ({
    key: `topic-${item.id ?? index}`,
    id: item.id ?? index,
    kind: "topic",
    title: item.topicName ?? `${zh ? "主题" : "Topic"} ${index + 1}`,
    subtitle: item.topicType ?? `${displayValue(item.readQueueNum)} / ${displayValue(item.writeQueueNum)} queues`,
    tone: "orange",
    status: item.status,
    raw: item,
  }));
  const groupNodes = groups.map((item, index) => ({
    key: `group-${item.id ?? index}`,
    id: item.id ?? index,
    kind: "group",
    title: item.name ?? `${zh ? "消费组" : "Group"} ${index + 1}`,
    subtitle: Number(item.type) === 0 ? (zh ? "消费者" : "Consumer") : (zh ? "生产者" : "Producer"),
    tone: "orange",
    status: item.state ?? item.status,
    raw: item,
  }));
  const eventMesh = {
    id: "eventmesh",
    kind: "eventmesh",
    title: `${cluster.name} ${zh ? "集群" : "cluster"}`,
    subtitle: zh ? "事件总线中枢" : "Event bus core",
    tone: "blue",
    status: cluster.status,
    clusterType: cluster.clusterType,
    source: { ...cluster, kind: "eventmesh", nodes: directRuntimes },
    nodes: directRuntimes,
    metadata,
    footer: [["Runtime", directRuntimes.length], [zh ? "主题" : "Topics", topics.length], [zh ? "消费组" : "Groups", groups.length]],
  };
  const components = [eventMesh, ...metadata, ...stores];
  if (topicNodes.length || groupNodes.length) components.push({
    id: "resources", kind: "resource", title: zh ? "事件资源" : "Event resources", subtitle: "Topic / Consumer Group", tone: "orange", status: aggregateStatus([...topicNodes, ...groupNodes]), nodes: [...topicNodes, ...groupNodes],
    footer: [[zh ? "主题" : "Topics", topicNodes.length], [zh ? "消费组" : "Groups", groupNodes.length]],
  });
  return { components, eventMesh, metadata, stores, resources: components.find((item) => item.id === "resources") };
}

function MiniNode({ item, onClick, selected, searchState = "" }) {
  return <button type="button" className={`et-mini-node status-${normalizedStatus(item.status)} ${selected ? "selected" : ""} ${searchState}`} onClick={onClick}>
    <InstanceGlyph tone={item.tone} />
    <strong>{item.title}</strong>
    <small><StatusIcon status={item.status} />{item.subtitle}</small>
  </button>;
}

function ClusterCard({ component, language, onOpen, onHover, compact = false }) {
  const open = () => onOpen(component.id);
  return <article
    className={`et-cluster-card ${component.tone} status-${normalizedStatus(component.status)} ${compact ? "compact" : ""}`}
    role="button"
    tabIndex={0}
    aria-label={`${language === "zh" ? "进入" : "Open"} ${component.title}`}
    onClick={open}
    onMouseEnter={() => onHover?.(component.id)}
    onMouseLeave={() => onHover?.(null)}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    }}
  >
    <header><span className="et-card-icon">{iconFor(component.kind)}</span><span><strong>{component.title}</strong><small>{component.subtitle}</small></span><StatusPill status={component.status} language={language} /></header>
    <div className="et-cluster-card-body">
      {component.nodes.slice(0, compact ? 3 : 4).map((node) => <div className="et-card-preview" key={node.key}><InstanceGlyph tone={component.tone} /><span><strong>{node.title}</strong><small>{node.subtitle}</small></span></div>)}
      {!component.nodes.length && <div className="et-no-instance"><CloudServerOutlined /><span>{language === "zh" ? "接口未返回实例" : "No instances returned"}</span></div>}
    </div>
    <footer><span>{component.footer?.map(([label, value]) => <em key={label}><small>{label}</small><b>{value}</b></em>)}</span><span className="et-drill-hint">{language === "zh" ? "点击进入" : "Open"} <b>→</b></span></footer>
  </article>;
}

function EventMeshCard({ component, metadata, language, onOpen, onHover }) {
  const open = () => onOpen(component.id);
  return <article
    className={`et-eventmesh-card status-${normalizedStatus(component.status)}`}
    role="button"
    tabIndex={0}
    aria-label={`${language === "zh" ? "进入" : "Open"} ${component.title}`}
    onClick={open}
    onMouseEnter={() => onHover?.(component.id)}
    onMouseLeave={() => onHover?.(null)}
    onKeyDown={(event) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open();
      }
    }}
  >
    <header><span className="et-card-icon"><ClusterOutlined /></span><span><strong>{component.title}</strong><small>{component.subtitle}</small></span><StatusPill status={component.status} language={language} /></header>
    <div className="et-registry-block">
      <div><strong>{language === "zh" ? "注册 / 元数据" : "Registry / metadata"}</strong><span>{language === "zh" ? "服务发现与配置" : "Discovery and configuration"}</span></div>
      <div className="et-registry-chips">
        {metadata.map((item) => <button key={item.id} type="button" onClick={(event) => { event.stopPropagation(); onOpen(item.id); }}><i />{item.title}<span>›</span></button>)}
        {!metadata.length && <span className="et-registry-empty">{language === "zh" ? "后端未返回元数据依赖" : "No metadata dependency returned"}</span>}
      </div>
    </div>
    <div className="et-runtime-block">
      <div><strong>Runtime {language === "zh" ? "集群" : "cluster"}</strong><span>{language === "zh" ? "协议转换 · 路由 · 转发" : "Protocol · routing · delivery"}</span></div>
      <div className="et-runtime-preview">
        {component.nodes.slice(0, 3).map((node) => <div className={`status-${normalizedStatus(node.status)}`} key={node.key}><InstanceGlyph /><strong>{node.title}</strong><small><StatusIcon status={node.status} />{statusCopy(node.status, language)}</small></div>)}
        {!component.nodes.length && <div className="et-no-instance wide"><CloudServerOutlined /><span>{language === "zh" ? "后端未返回 Runtime" : "No Runtime returned"}</span></div>}
      </div>
    </div>
    <footer><span>{component.footer.map(([label, value]) => <em key={label}><small>{label}</small><b>{value}</b></em>)}</span><span className="et-drill-hint">{language === "zh" ? "点击进入" : "Open"} <b>→</b></span></footer>
  </article>;
}

function GlobalFlowEdges({ stores, activeId, hasAccess, hasResources }) {
  const singleStore = stores.length === 1;
  const storeWidth = 260;
  const storeGap = 15;
  const totalWidth = stores.length ? stores.length * storeWidth + (stores.length - 1) * storeGap : 0;
  const storeStart = (1180 - totalWidth) / 2;
  const targets = stores.map((_, index) => singleStore ? 600 : storeStart + index * (storeWidth + storeGap) + storeWidth / 2);
  const firstTarget = targets[0] ?? 590;
  const lastTarget = targets.at(-1) ?? 590;
  const branchLeft = Math.min(600, firstTarget);
  const branchRight = Math.max(600, lastTarget);
  return <div className="et-stage-connectors" aria-hidden="true">
    {hasAccess && <span className={`et-flow-edge access-line ${activeId === "access" || activeId === "eventmesh" ? "active" : ""}`}><span className="et-edge-head"><ArrowRightOutlined /></span><span className="et-flow-arrow"><ArrowRightOutlined /></span></span>}
    {hasResources && <span className={`et-flow-edge resource-line ${activeId === "resources" || activeId === "eventmesh" ? "active" : ""}`}><span className="et-edge-head"><ArrowRightOutlined /></span><span className="et-flow-arrow"><ArrowRightOutlined /></span></span>}
    {!!stores.length && <span className={`et-store-network ${singleStore ? "single" : "branched"}`}>
      {singleStore ? <i className={`et-store-single ${stores[0].tone} ${activeId === "eventmesh" || activeId === stores[0].id ? "active" : ""}`} style={{ left: targets[0] }}><span className="et-store-head"><ArrowDownOutlined /></span></i> : <>
        <i className="et-store-trunk" />
        <i className="et-store-branch" style={{ left: branchLeft, width: Math.max(1, branchRight - branchLeft) }} />
        {targets.map((target, index) => <i className={`et-store-drop ${stores[index].tone} ${activeId === "eventmesh" || activeId === stores[index].id ? "active" : ""}`} key={stores[index].id} style={{ left: target }}><span className="et-store-head"><ArrowDownOutlined /></span></i>)}
      </>}
    </span>}
  </div>;
}

function GlobalStage({ model, language, query, onOpen }) {
  const [activeId, setActiveId] = useState(null);
  const matches = (component) => !query || `${component.title} ${component.subtitle} ${component.clusterType ?? ""}`.toLowerCase().includes(query.toLowerCase());
  return <div className="et-global-stage">
    <GlobalFlowEdges stores={model.stores} activeId={activeId} hasAccess={false} hasResources={Boolean(model.resources)} />
    <div className="et-global-access" aria-hidden="true" />
    <div className={`et-global-core ${matches(model.eventMesh) ? (query ? "search-hit" : "") : "muted"}`}><EventMeshCard component={model.eventMesh} metadata={model.metadata} language={language} onOpen={onOpen} onHover={setActiveId} /></div>
    <div className={`et-global-resources ${model.resources && matches(model.resources) ? (query ? "search-hit" : "") : "muted"}`}>
      {model.resources ? <ClusterCard component={model.resources} language={language} onOpen={onOpen} onHover={setActiveId} /> : <div className="et-optional-empty"><AppstoreOutlined /><span>{language === "zh" ? "暂无事件资源" : "No event resources"}</span></div>}
    </div>
    <div className={`et-store-caption ${model.stores.length === 1 ? "single" : ""}`}><i />{language === "zh" ? "消息中间件（Event Store）" : "Message middleware (Event Store)"}</div>
    <div className={`et-global-stores ${model.stores.length === 1 ? "single" : ""}`}>
      {model.stores.map((component) => <div key={component.id} className={matches(component) ? (query ? "search-hit" : "") : "muted"}><ClusterCard compact component={component} language={language} onOpen={onOpen} onHover={setActiveId} /></div>)}
      {!model.stores.length && <div className="et-store-empty"><DatabaseOutlined /><span>{language === "zh" ? "后端未返回消息存储依赖" : "No event-store dependency returned"}</span></div>}
    </div>
  </div>;
}

function ComponentStage({ component, language, query, selectedKey, onSelect, onDrill }) {
  const normalizedQuery = query.trim().toLowerCase();
  const nodeMatches = (node) => !normalizedQuery || `${node.title} ${node.subtitle} ${node.host ?? ""} ${node.port ?? ""}`.toLowerCase().includes(normalizedQuery);
  const matchingCount = component.nodes.filter(nodeMatches).length;
  return <div className={`et-component-stage ${component.tone} status-${normalizedStatus(component.status)}`}>
    <section className="et-component-hero">
      <span className="et-card-icon">{iconFor(component.kind)}</span>
      <div><small>{language === "zh" ? "集群组件" : "Cluster component"}</small><h2>{component.title}</h2><p>{component.subtitle}</p></div>
      <StatusPill status={component.status} language={language} />
      <div className="et-component-count"><strong>{component.nodes.length}</strong><span>{language === "zh" ? "实例 / 资源" : "instances / resources"}</span></div>
    </section>
    {component.id === "eventmesh" && component.metadata?.length > 0 && <section className="et-related-components"><div><strong>{language === "zh" ? "注册与元数据组件" : "Registry and metadata"}</strong><span>{language === "zh" ? "点击组件继续查看内部集群" : "Open a component to inspect its internal cluster"}</span></div>{component.metadata.map((item) => <button key={item.id} type="button" onClick={() => onDrill(item.id)}><DatabaseOutlined /><span><strong>{item.title}</strong><small>{item.nodes.length} {language === "zh" ? "个实例" : "instances"}</small></span><b>→</b></button>)}</section>}
    <section className="et-instance-section">
      <div className="et-instance-heading"><span><strong>{language === "zh" ? "内部节点" : "Internal nodes"}</strong><small>{language === "zh" ? "选择节点后在右侧查看数据库资源字段" : "Select a node to inspect database-backed fields"}</small></span><em>{matchingCount} / {component.nodes.length}</em></div>
      <div className="et-instance-grid">
        {component.nodes.map((node) => <MiniNode key={node.key} item={node} selected={selectedKey === node.key} searchState={normalizedQuery ? (nodeMatches(node) ? "search-hit" : "search-dim") : ""} onClick={() => onSelect(node)} />)}
      </div>
      {!component.nodes.length && <div className="et-component-empty"><SearchOutlined /><strong>{language === "zh" ? "后端未返回该组件的实例" : "The backend returned no instances"}</strong><span>{language === "zh" ? "当前页面不会生成演示节点。" : "This view does not generate demo nodes."}</span></div>}
    </section>
  </div>;
}

function ResourceTreeTitle({ node, language }) {
  return <span className={`et-tree-node status-${normalizedStatus(node.status)} ${node.virtual ? "virtual" : "real"}`}>
    <span className="et-tree-node-icon">{iconFor(node.kind)}</span>
    <span className="et-tree-node-copy"><strong title={node.title}>{node.title}</strong><small title={node.subtitle}>{node.subtitle || resourceKindCopy(node, language)}</small></span>
    <span className="et-tree-node-meta">
      <em>{node.virtual ? (language === "zh" ? "资源目录" : "Resource directory") : resourceKindCopy(node, language)}</em>
      {!node.virtual && <StatusPill status={node.status} language={language} />}
    </span>
  </span>;
}

function ResourceTreeStage({ root, language, query, kind, status, selectedKey, onKindChange, onStatusChange, onSelect }) {
  const [expandedKeys, setExpandedKeys] = useState([]);
  const hasActiveFilter = Boolean(query.trim()) || kind !== "all" || status !== "all";
  const allNodes = useMemo(() => flattenResourceTree(root), [root]);
  const resourceCount = allNodes.filter((node) => !node.virtual).length;
  const filtered = useMemo(() => hasActiveFilter ? filterResourceTree(root, { query, kind, status }) : {
    tree: root,
    matchCount: resourceCount,
    expandedKeys: [],
  }, [hasActiveFilter, kind, query, resourceCount, root, status]);
  useEffect(() => {
    if (!root) return;
    setExpandedKeys([root.key, ...(root.children ?? []).filter((node) => node.virtual).map((node) => node.key)]);
  }, [root]);
  const visibleExpandedKeys = hasActiveFilter ? filtered.expandedKeys : expandedKeys;
  return <div className="et-tree-stage">
    <div className="et-tree-toolbar">
      <div><strong>{language === "zh" ? "资源定位" : "Resource locator"}</strong><span>{hasActiveFilter ? (language === "zh" ? `${filtered.matchCount} 个匹配资源` : `${filtered.matchCount} matching resources`) : (language === "zh" ? `${resourceCount} 个可查询资源` : `${resourceCount} searchable resources`)}</span></div>
      <Select size="small" value={kind} onChange={onKindChange} aria-label={language === "zh" ? "资源类型" : "Resource type"} options={[
        { value: "all", label: language === "zh" ? "全部类型" : "All types" },
        { value: "cluster", label: language === "zh" ? "集群" : "Clusters" },
        { value: "runtime", label: "Runtime" },
        { value: "topic", label: "Topic" },
        { value: "consumer-group", label: language === "zh" ? "消费组" : "Consumer groups" },
      ]} />
      <Select size="small" value={status} onChange={onStatusChange} aria-label={language === "zh" ? "运行状态" : "Status"} options={[
        { value: "all", label: language === "zh" ? "全部状态" : "All status" },
        { value: "healthy", label: language === "zh" ? "正常" : "Healthy" },
        { value: "warning", label: language === "zh" ? "警告" : "Warning" },
        { value: "error", label: language === "zh" ? "异常" : "Abnormal" },
        { value: "unknown", label: language === "zh" ? "未知" : "Unknown" },
      ]} />
      <div className="et-tree-expand-actions"><Button size="small" disabled={hasActiveFilter} onClick={() => setExpandedKeys(resourceTreeExpandedKeys(root))}>{language === "zh" ? "全部展开" : "Expand all"}</Button><Button size="small" disabled={hasActiveFilter} onClick={() => setExpandedKeys([root.key])}>{language === "zh" ? "全部收起" : "Collapse all"}</Button></div>
    </div>
    <div className="et-tree-content">
      {filtered.tree ? <Tree
        blockNode
        showLine={{ showLeafIcon: false }}
        virtual
        height={520}
        treeData={[filtered.tree]}
        expandedKeys={visibleExpandedKeys}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onExpand={(keys) => setExpandedKeys(keys)}
        onSelect={(_, info) => onSelect(info.node)}
        titleRender={(node) => <ResourceTreeTitle node={node} language={language} />}
      /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={language === "zh" ? "没有符合条件的资源" : "No matching resources"} />}
    </div>
  </div>;
}

function Inspector({ node, language, onClose, path = [] }) {
  return <aside className={`et-inspector ${node ? "has-node" : ""}`}>
    <header><span><strong>{language === "zh" ? "节点详情" : "Node details"}</strong><small>{language === "zh" ? "运行状态、资源、流量和基础信息" : "Status, resources, traffic and identity"}</small></span><button type="button" aria-label={language === "zh" ? "关闭详情" : "Close details"} onClick={onClose}><CloseOutlined /></button></header>
    {!node ? <div className="et-inspector-empty"><span><SearchOutlined /></span><strong>{language === "zh" ? "选择一个节点" : "Select a node"}</strong><p>{language === "zh" ? "进入第二层组件后，点击 Runtime、Broker、连接、Topic 或消费组，即可查看真实资源字段。" : "Open a component, then select a Runtime, broker, connection, topic, or group to inspect live fields."}</p></div> : <div className="et-inspector-body">
      <div className={`et-inspector-identity ${node.tone ?? "blue"}`}><span>{iconFor(node.kind)}</span><div><small>{node.kind}</small><strong>{node.title ?? node.name}</strong>{node.virtual ? <em className="et-directory-label">{language === "zh" ? "资源目录 · 非拓扑边" : "Resource directory · not a topology edge"}</em> : <StatusPill status={node.status ?? node.raw?.status ?? node.raw?.state} language={language} />}</div></div>
      {!!path.length && <div className="et-inspector-path"><small>{language === "zh" ? "完整路径" : "Full path"}</small><span>{path.map((item, index) => <span key={item.key}>{index > 0 && <b>/</b>}<em>{item.title ?? item.name}</em></span>)}</span><strong>{relationCopy(node.relation, language)}</strong></div>}
      <dl>{rowsForNode(node, language).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <div className="et-data-note"><ApiOutlined /><span><strong>{language === "zh" ? "数据来源" : "Data source"}</strong><small>{language === "zh" ? "仅展示当前后端接口与数据库已返回的字段；CPU、内存、吞吐和延迟未返回时不生成演示值。" : "Only fields returned by the current backend are shown. Missing CPU, memory, throughput, and latency values are never fabricated."}</small></span></div>
    </div>}
  </aside>;
}

function graphLocationForTreeNode(model, treeNode) {
  if (!treeNode || treeNode.relation === "ROOT") return { component: null, node: null };
  if (["resources", "topics", "groups"].includes(treeNode.directoryType)) return { component: "resources", node: null };
  const component = model.components.find((item) => item.id === treeNode.key || item.nodes.some((node) => node.key === treeNode.key));
  if (!component) return { component: null, node: null };
  return { component: component.id, node: component.nodes.some((node) => node.key === treeNode.key) ? treeNode.key : null };
}

export function TopologyExperience({ cluster, topology, runtimes = [], topics = [], groups = [], error, loading, fetching, fetchedAt, onRefresh, onExit }) {
  const { language } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const demoTimers = useRef([]);
  const [demoRunning, setDemoRunning] = useState(false);
  const model = useMemo(() => buildComponents({ cluster, topology, runtimes, topics, groups, language }), [cluster, groups, language, runtimes, topics, topology]);
  const treeRoot = useMemo(() => buildResourceTree({ cluster, topology, runtimes, topics, groups, language }), [cluster, groups, language, runtimes, topics, topology]);
  const mode = searchParams.get("mode") === "tree" ? "tree" : "graph";
  const componentId = searchParams.get("component");
  const nodeKey = searchParams.get("node");
  const query = searchParams.get("q") ?? "";
  const resourceKind = searchParams.get("kind") ?? "all";
  const resourceStatus = searchParams.get("status") ?? "all";
  const currentComponent = model.components.find((item) => item.id === componentId) ?? null;
  const selectedNode = currentComponent?.nodes.find((item) => item.key === nodeKey) ?? null;
  const selectedTreeNode = findResourceNode(treeRoot, nodeKey) ?? treeRoot;
  const treePath = (selectedTreeNode?.pathKeys ?? []).map((key) => findResourceNode(treeRoot, key)).filter(Boolean);
  const componentNodes = model.components.flatMap((item) => item.nodes);
  const warningCount = componentNodes.filter((node) => normalizedStatus(node.status ?? node.raw?.status ?? node.raw?.state) === "warning").length;
  const errorCount = componentNodes.filter((node) => normalizedStatus(node.status ?? node.raw?.status ?? node.raw?.state) === "error").length;
  const allNodes = componentNodes.length;
  const healthyNodes = componentNodes.filter((node) => normalizedStatus(node.status ?? node.raw?.status ?? node.raw?.state) === "healthy").length;
  const updateParams = (changes) => {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(changes).forEach(([key, value]) => value == null || value === "" ? next.delete(key) : next.set(key, String(value)));
      return next;
    }, { replace: true });
  };
  const openComponent = (id) => updateParams({ component: id, node: null, q: null });
  const selectNode = (node) => updateParams({ node: node.key });
  const switchMode = (nextMode) => {
    stopDemo();
    if (nextMode === "tree") {
      updateParams({ mode: "tree", node: selectedNode?.key ?? nodeKey });
      return;
    }
    const target = graphLocationForTreeNode(model, selectedTreeNode);
    updateParams({ mode: null, kind: null, status: null, component: target.component, node: target.node });
  };
  const goBack = () => {
    if (mode === "tree") {
      if (selectedTreeNode?.parentKey) updateParams({ node: selectedTreeNode.parentKey });
      else onExit();
      return;
    }
    if (selectedNode) updateParams({ node: null });
    else if (currentComponent) updateParams({ component: null, node: null });
    else onExit();
  };
  const goGlobal = () => updateParams({ component: null, node: mode === "tree" ? treeRoot.key : null, q: null });
  const stopDemo = () => {
    demoTimers.current.forEach((timer) => window.clearTimeout(timer));
    demoTimers.current = [];
    setDemoRunning(false);
  };
  const playDemo = () => {
    if (demoRunning) {
      stopDemo();
      return;
    }
    stopDemo();
    setDemoRunning(true);
    goGlobal();
    demoTimers.current = [
      window.setTimeout(() => openComponent("eventmesh"), 700),
      window.setTimeout(() => model.eventMesh.nodes[0] && updateParams({ component: "eventmesh", node: model.eventMesh.nodes[0].key }), 1_800),
      window.setTimeout(() => setDemoRunning(false), 3_000),
    ];
  };
  useEffect(() => () => demoTimers.current.forEach((timer) => window.clearTimeout(timer)), []);
  const step = selectedNode ? 3 : currentComponent ? 2 : 1;
  return <div className="topology-experience">
    <header className="et-topbar">
      <div className="et-brand"><span><img src={eventMeshLogo} alt="EventMesh" /></span><div><strong>EventMesh {language === "zh" ? "集群图" : "Cluster Graph"}</strong><small>Cluster topology &amp; observability dashboard</small></div></div>
      <span className="et-environment"><i />{cluster.region && cluster.region !== "—" ? cluster.region : (language === "zh" ? "当前环境" : "Current environment")}</span>
      <div className="et-kpis"><div><small>{language === "zh" ? "正常节点" : "Healthy nodes"}</small><strong>{healthyNodes} / {allNodes}</strong></div><div><small>{language === "zh" ? "警告 / 异常" : "Warning / abnormal"}</small><strong className={errorCount ? "error" : warningCount ? "warning" : ""}>{warningCount} / {errorCount}</strong></div><div><small>Runtime</small><strong>{runtimes.length}</strong></div><div><small>Topics</small><strong>{topics.length}</strong></div></div>
      <span className="et-updated">{language === "zh" ? "更新于" : "Updated"} {formatTime(fetchedAt, language)}</span>
    </header>
    <div className="et-commandbar">
      <div className="et-command-leading"><button type="button" className="et-back" onClick={goBack}>← <span>{language === "zh" ? "返回" : "Back"}</span></button><div className="et-view-switch" role="group" aria-label={language === "zh" ? "拓扑视图" : "Topology view"}><button type="button" className={mode === "graph" ? "active" : ""} aria-pressed={mode === "graph"} onClick={() => switchMode("graph")}><ApartmentOutlined />{language === "zh" ? "关系图" : "Graph"}</button><button type="button" className={mode === "tree" ? "active" : ""} aria-pressed={mode === "tree"} onClick={() => switchMode("tree")}><UnorderedListOutlined />{language === "zh" ? "资源树" : "Resource tree"}</button></div></div>
      <nav className="et-breadcrumb" aria-label={language === "zh" ? "拓扑路径" : "Topology path"}>
        {mode === "tree" ? treePath.map((item, index) => <span className="et-tree-crumb" key={item.key}>{index > 0 && <b>/</b>}<button type="button" className={index === treePath.length - 1 ? "current" : ""} onClick={() => updateParams({ node: item.key })} disabled={index === treePath.length - 1}>{item.title}</button></span>) : <>
          <button type="button" className={!currentComponent ? "current" : ""} onClick={goGlobal} disabled={!currentComponent}>{language === "zh" ? "全局拓扑" : "Global topology"}</button>
          {currentComponent && <><span>/</span><button type="button" className={!selectedNode ? "current" : ""} onClick={() => updateParams({ node: null })} disabled={!selectedNode}>{currentComponent.title}</button></>}
          {selectedNode && <><span>/</span><strong>{selectedNode.title}</strong></>}
        </>}
      </nav>
      {mode === "tree" ? <div className="et-tree-command-summary"><FolderOpenOutlined /><span><strong>{language === "zh" ? "资源树" : "Resource tree"}</strong><small>{language === "zh" ? "关系与资源目录" : "Relationships and resource directories"}</small></span></div> : <ol className="et-steps"><li className={step === 1 ? "active" : "done"}><i>1</i><span>{language === "zh" ? "全局总览" : "Global"}</span></li><li className={step === 2 ? "active" : step > 2 ? "done" : ""}><i>2</i><span>{language === "zh" ? "集群组件" : "Component"}</span></li><li className={step === 3 ? "active" : ""}><i>3</i><span>{language === "zh" ? "节点实例" : "Instance"}</span></li></ol>}
      <label className="et-search"><SearchOutlined /><input value={query} onChange={(event) => updateParams({ q: event.target.value })} placeholder={mode === "tree" ? (language === "zh" ? "搜索名称 / ID / 类型 / 地址" : "Search name / ID / type / address") : (language === "zh" ? "搜索节点 / 集群" : "Search nodes / clusters")} /></label>
      <button type="button" className="et-refresh" onClick={onRefresh}><ReloadOutlined spin={fetching} />{language === "zh" ? "刷新数据" : "Refresh"}</button>
    </div>
    <main className="et-workbench">
      <section className="et-main-panel">
        <header className="et-panel-heading"><div><h1>{mode === "tree" ? (language === "zh" ? "资源树" : "Resource tree") : currentComponent?.title ?? (language === "zh" ? "全局拓扑" : "Global topology")}</h1><p>{mode === "tree" ? (language === "zh" ? "按真实依赖和资源归属快速定位集群、Runtime 与消息资源" : "Locate clusters, Runtimes, and messaging resources by dependency and ownership") : currentComponent ? (language === "zh" ? "查看组件内部集群，选择节点后在右侧检查资源数据" : "Inspect the internal cluster and select a node for resource data") : (language === "zh" ? "先看系统边界：应用如何接入、EventMesh 如何转发、事件最终流向哪里" : "Understand system boundaries, EventMesh routing, and event destinations")}</p></div>{mode === "graph" && <div><button type="button" className="et-demo" onClick={playDemo}>{demoRunning ? "■" : "▶"} {language === "zh" ? (demoRunning ? "停止演示" : "演示下钻") : (demoRunning ? "Stop demo" : "Demo drill-down")}</button><button type="button" onClick={goGlobal}>⌂ {language === "zh" ? "回到全局" : "Global"}</button></div>}</header>
        <div className={`et-legend ${mode === "tree" ? "tree" : ""}`}><span><b>{language === "zh" ? "状态" : "Status"}</b></span><StatusLegendItem status="Healthy" language={language} /><StatusLegendItem status="Warning" language={language} /><StatusLegendItem status="Error" language={language} /><StatusLegendItem status="Unknown" language={language} />{mode === "tree" ? <em><FolderOutlined /> {language === "zh" ? "资源目录仅用于定位，不代表真实拓扑边" : "Resource directories aid discovery and do not represent topology edges"}</em> : <em>{language === "zh" ? "点击集群卡片逐层进入；点击节点查看右侧详情" : "Open cluster cards, then select nodes for details"}</em>}</div>
        {error && <Alert className="et-api-alert" type="warning" showIcon title={language === "zh" ? "部分拓扑关系暂不可用" : "Some topology relationships are unavailable"} description={error} />}
        <div className={`et-canvas-scroll ${mode === "tree" ? "tree" : ""}`}>
          {loading ? <div className="et-loading"><Spin size="large" /><span>{language === "zh" ? "正在读取拓扑数据" : "Loading topology data"}</span></div> : mode === "tree" ? <ResourceTreeStage root={treeRoot} language={language} query={query} kind={resourceKind} status={resourceStatus} selectedKey={selectedTreeNode?.key} onKindChange={(value) => updateParams({ kind: value === "all" ? null : value })} onStatusChange={(value) => updateParams({ status: value === "all" ? null : value })} onSelect={selectNode} /> : currentComponent ? <ComponentStage component={currentComponent} language={language} query={query} selectedKey={selectedNode?.key} onSelect={selectNode} onDrill={openComponent} /> : <GlobalStage model={model} language={language} query={query} onOpen={openComponent} />}
        </div>
        <footer className="et-guidance"><InfoCircleOutlined /><span><strong>{language === "zh" ? "推荐交互：" : "Suggested flow: "}</strong>{mode === "tree" ? (language === "zh" ? "输入名称、ID、类型或地址定位资源；选择节点后查看完整路径与真实字段。" : "Search by name, ID, type, or address, then inspect the full path and live fields.") : (language === "zh" ? "第一层看系统边界，第二层看集群组件，第三层看实例与运行字段。" : "See system boundaries first, cluster components second, and live instance fields third.")}</span></footer>
      </section>
      <Inspector node={mode === "tree" ? selectedTreeNode : selectedNode} language={language} path={mode === "tree" ? treePath : []} onClose={() => updateParams({ node: mode === "tree" ? treeRoot.key : null })} />
    </main>
  </div>;
}
