import { useEffect, useMemo, useState } from "react";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  CheckCircleOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  HddOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Button, Input, Select, Tag } from "antd";
import ReactECharts from "echarts-for-react";
import { useNavigate, useParams } from "react-router-dom";
import { mockClusters } from "./mockClusterData";
import {
  MOCK_RELATION_STORAGE_KEY,
  defaultMockRelationState,
  mockComponentClusters,
  normalizeMockRelationState,
} from "./mockClusterRelations";
import { storageClusterConsolePath } from "./routes";
import { CreateNodeModal, CreateTopicModal } from "./MockResourceCreateModals";
import { useMockWritableResources } from "./mockWritableResources";

const allowedPanels = ["overview", "brokers", "topics", "groups", "relations"];
const panelLabels = { overview: "概要", brokers: "Broker", topics: "Topic", groups: "消费组", relations: "关联 EventMesh" };

function readRelations() {
  if (typeof window === "undefined") return defaultMockRelationState().relations;
  try {
    return normalizeMockRelationState(JSON.parse(window.localStorage.getItem(MOCK_RELATION_STORAGE_KEY) || "null")).relations;
  } catch {
    return defaultMockRelationState().relations;
  }
}

function StorageStatus({ value }) {
  const healthy = value === "healthy";
  return <span className={`storage-console-status ${healthy ? "healthy" : "warning"}`}>{healthy ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}{healthy ? "正常" : "需关注"}</span>;
}

function physicalTopics(engine, clusterId) {
  const names = engine === "kafka"
    ? ["codex-sim-order-created", "codex-sim-payment-status", "codex-sim-inventory-sync", "codex-sim-audit-log"]
    : ["codex-sim-trade-events", "codex-sim-refund-events", "codex-sim-shipment-events", "codex-sim-delay-jobs"];
  return names.map((name, index) => ({
    id: `${clusterId}-${index + 1}`,
    name,
    partitions: engine === "kafka" ? [12, 12, 8, 6][index] : [8, 8, 6, 4][index],
    replicas: engine === "kafka" ? 3 : 2,
    inRate: `${(18.6 - index * 2.3).toFixed(1)}K/s`,
    outRate: `${(15.8 - index * 1.9).toFixed(1)}K/s`,
    storage: `${(482 - index * 73).toFixed(0)} GB`,
    status: index === 3 ? "warning" : "healthy",
  }));
}

function consumerGroups(engine, topics) {
  const names = engine === "kafka"
    ? ["codex-sim-order-workers", "codex-sim-payment-workers", "codex-sim-audit-sink"]
    : ["codex-sim-trade-consumers", "codex-sim-logistics-consumers", "codex-sim-delay-consumers"];
  return names.map((name, index) => ({ name, topic: topics[index % topics.length].name, members: index + 2, rate: `${(12.7 - index * 2.1).toFixed(1)}K/s`, lag: index === 1 ? "8.4K" : `${1.2 + index * .4}K`, status: index === 1 ? "warning" : "healthy" }));
}

function StorageRateChart({ engine }) {
  const option = useMemo(() => ({
    animationDuration: 450,
    color: ["#225aa0", "#4cb6d4"],
    tooltip: { trigger: "axis" },
    legend: { right: 8, top: 0, itemWidth: 18, textStyle: { color: "#5f7388" }, data: ["写入", "读取"] },
    grid: { left: 52, right: 22, top: 42, bottom: 32 },
    xAxis: { type: "category", boundaryGap: false, data: ["09:00", "09:10", "09:20", "09:30", "09:40", "09:50", "10:00", "10:10", "10:20", "10:30", "10:40", "10:50"], axisLine: { lineStyle: { color: "#b9c9d9" } }, axisLabel: { color: "#6b7e92" } },
    yAxis: { type: "value", name: "K 条/s", splitLine: { lineStyle: { color: "#e5edf5" } }, axisLabel: { color: "#6b7e92" } },
    series: [
      { name: "写入", type: "line", smooth: true, symbol: "none", lineStyle: { width: 2 }, data: engine === "kafka" ? [54, 58, 57, 62, 66, 64, 69, 72, 70, 75, 73, 78] : [46, 49, 52, 51, 56, 59, 58, 62, 65, 64, 68, 70] },
      { name: "读取", type: "line", smooth: true, symbol: "none", lineStyle: { width: 2 }, data: engine === "kafka" ? [47, 49, 51, 55, 57, 56, 61, 63, 62, 66, 65, 69] : [39, 42, 43, 46, 48, 51, 50, 54, 56, 55, 59, 61] },
    ],
  }), [engine]);
  return <ReactECharts option={option} style={{ height: 270 }} />;
}

function ResourceTable({ title, description, columns, rows, searchPlaceholder = "搜索资源", action=null }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) => row.search.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel storage-resource-panel"><div className="storage-resource-toolbar"><div><h2>{title}</h2><p>{description}</p></div><div><Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} /><Button icon={<ReloadOutlined />}>刷新</Button>{action}</div></div><div className="resource-table-wrap"><table className="resource-table storage-resource-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table>{!filtered.length && <div className="storage-console-empty"><SearchOutlined /><strong>未找到匹配资源</strong><span>请调整搜索条件。</span></div>}</div></section>;
}

export function MockStorageClusterConsole() {
  const navigate = useNavigate();
  const { clusterId, engine, storageClusterId, panel } = useParams();
  const { state: writableState, addNode, addPhysicalTopic } = useMockWritableResources();
  const [brokerOpen, setBrokerOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const normalizedEngine = engine === "rocketmq" ? "rocketmq" : "kafka";
  const activePanel = allowedPanels.includes(panel) ? panel : "overview";
  const baseStorage = mockComponentClusters.find((item) => item.id === storageClusterId && item.type === normalizedEngine);
  const storage = baseStorage ? { ...baseStorage, nodes: [...baseStorage.nodes, ...writableState.nodes.filter((item) => item.clusterId === baseStorage.id)] } : null;
  const relations = useMemo(readRelations, []);
  useEffect(() => {
    if (panel && !allowedPanels.includes(panel) && storage) navigate(storageClusterConsolePath(clusterId, normalizedEngine, storage.id), { replace: true });
  }, [clusterId, navigate, normalizedEngine, panel, storage]);
  if (!storage) return <section className="panel storage-console-missing"><HddOutlined /><h1>未找到存储集群</h1><p>该集群不存在，或类型与访问路径不一致。</p><Button type="primary" onClick={() => navigate(`/clusters/${clusterId}/storage?section=${normalizedEngine}`)}>返回集群列表</Button></section>;

  const isKafka = normalizedEngine === "kafka";
  const engineName = isKafka ? "Kafka" : "RocketMQ";
  const topics = [...physicalTopics(normalizedEngine, storage.id), ...writableState.physicalTopics.filter((item) => item.storageClusterId === storage.id)];
  const groups = consumerGroups(normalizedEngine, topics);
  const storageRelations = relations.filter((item) => item.componentClusterId === storage.id);
  const healthyBrokers = storage.nodes.filter((item) => item.status === "healthy").length;
  const panelPath = (nextPanel) => storageClusterConsolePath(clusterId, normalizedEngine, storage.id, nextPanel);
  const brokerRows = storage.nodes.map((node, index) => ({ key: node.id, search: `${node.name} ${node.address} ${node.role}`, cells: [<span className="storage-primary-cell"><DatabaseOutlined /><span><strong>{node.name}</strong><small>{node.id}</small></span></span>, node.role, node.address, isKafka ? `broker-${index + 1}` : index === 0 ? "Master" : "Slave", `${38 + index * 5}% / ${52 + index * 4}%`, <StorageStatus value={node.status} />] }));
  const topicRows = topics.map((topic) => ({ key: topic.id, search: topic.name, cells: [<span className="storage-primary-cell"><AppstoreOutlined /><strong>{topic.name}</strong></span>, topic.partitions, topic.replicas, topic.inRate, topic.outRate, topic.storage, <StorageStatus value={topic.status} />] }));
  const groupRows = groups.map((group) => ({ key: group.name, search: `${group.name} ${group.topic}`, cells: [<span className="storage-primary-cell"><TeamOutlined /><strong>{group.name}</strong></span>, group.topic, group.members, group.rate, group.lag, <StorageStatus value={group.status} />] }));
  const relationRows = storageRelations.map((relation) => { const eventMesh = mockClusters.find((item) => item.id === relation.eventMeshClusterId); return { key: relation.id, search: `${relation.eventMeshClusterId} ${eventMesh?.description ?? ""}`, cells: [<span className="storage-primary-cell"><ClusterOutlined /><span><strong>{eventMesh?.name ?? relation.eventMeshClusterId}</strong><small>{eventMesh?.description ?? "复制或外部 EventMesh 集群"}</small></span></span>, "EventMesh → 存储集群", <span className="storage-console-status healthy"><LinkOutlined />关联生效</span>, new Date(relation.createdAt).toLocaleString("zh-CN", { hour12: false }), <Button type="link" onClick={() => navigate(`/clusters/${relation.eventMeshClusterId}/topology`)}>查看拓扑</Button>] }; });

  const overview = <div className="storage-console-overview">
    <section className="storage-console-metrics"><div><span>Broker</span><strong>{healthyBrokers} / {storage.nodes.length}</strong><small>正常 / 总数</small></div><div><span>Topic</span><strong>{topics.length}</strong><small>{topics.reduce((sum, item) => sum + item.partitions, 0)} {isKafka ? "分区" : "队列"}</small></div><div><span>消费组</span><strong>{groups.length}</strong><small>{groups.reduce((sum, item) => sum + item.members, 0)} 个活跃实例</small></div><div><span>消息写入</span><strong>{isKafka ? "78.0K/s" : "70.0K/s"}</strong><small>前端模拟速率</small></div><div><span>存储使用</span><strong>{isKafka ? "61%" : "48%"}</strong><small>{isKafka ? "1.8 TB / 3.0 TB" : "1.4 TB / 3.0 TB"}</small></div></section>
    <div className="storage-console-overview-grid"><section className="panel storage-console-chart"><div className="storage-console-section-title"><div><h2>消息读写趋势</h2><p>最近 2 小时全部 Topic 的汇总速率</p></div><Select defaultValue="2h" options={[{ value: "2h", label: "最近 2 小时" }, { value: "24h", label: "最近 24 小时" }]} /></div><StorageRateChart engine={normalizedEngine} /></section><section className="panel storage-console-facts"><div className="storage-console-section-title"><div><h2>集群信息</h2><p>{engineName} 存储集群的部署与关联信息</p></div><HddOutlined /></div><dl><div><dt>集群类型</dt><dd>{engineName}</dd></div><div><dt>版本</dt><dd>{storage.version}</dd></div><div><dt>地域</dt><dd>{storage.region}</dd></div><div><dt>关联 EventMesh</dt><dd>{storageRelations.length} 个</dd></div><div><dt>{isKafka ? "副本策略" : "Broker 模式"}</dt><dd>{isKafka ? "3 副本" : "Master / Slave"}</dd></div></dl></section></div>
    <section className="panel storage-console-health"><div className="storage-console-section-title"><div><h2>运行状态</h2><p>Broker、Topic 和消费进度的关键检查</p></div></div><div><span><CheckCircleOutlined /><small>Broker 可用性</small><strong>{healthyBrokers} / {storage.nodes.length}</strong><em>集群可正常读写</em></span><span><CheckCircleOutlined /><small>{isKafka ? "副本同步" : "主从同步"}</small><strong>正常</strong><em>无失步实例</em></span><span><CheckCircleOutlined /><small>可用 Topic</small><strong>{topics.filter((item) => item.status === "healthy").length} / {topics.length}</strong><em>1 个需关注</em></span><span className="warning"><ExclamationCircleOutlined /><small>消费积压</small><strong>8.4K</strong><em>{groups[1].name}</em></span></div></section>
  </div>;

  const panels = {
    overview,
    brokers: <ResourceTable title={`${engineName} Broker`} description={`查看 ${storage.name} 中的 Broker 实例`} columns={["Broker", "角色", "地址", isKafka ? "Broker ID" : "主从角色", "CPU / 内存", "状态"]} rows={brokerRows} searchPlaceholder="搜索 Broker 名称或地址" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setBrokerOpen(true)}>添加 Broker</Button>} />,
    topics: <ResourceTable title={`${engineName} Topic`} description={`这些 Topic 实际存储在当前 ${engineName} 集群中`} columns={["Topic", isKafka ? "分区" : "队列", "副本", "写入速率", "读取速率", "存储量", "状态"]} rows={topicRows} searchPlaceholder="搜索 Topic" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setTopicOpen(true)}>创建物理 Topic</Button>} />,
    groups: <ResourceTable title="消费组" description={`消费当前 ${engineName} 集群 Topic 的消费组`} columns={["消费组", "订阅 Topic", "实例", "消费速率", "积压", "状态"]} rows={groupRows} searchPlaceholder="搜索消费组或 Topic" />,
    relations: <ResourceTable title="关联 EventMesh" description="当前存储集群被哪些 EventMesh 集群使用" columns={["EventMesh 集群", "关系", "状态", "建立时间", "操作"]} rows={relationRows} searchPlaceholder="搜索 EventMesh 集群" />,
  };

  return <div className="page storage-cluster-console"><section className="storage-console-hero"><div><button onClick={() => navigate(`/clusters/${clusterId}/storage?section=${normalizedEngine}`)}>存储集群 / {engineName} 集群 /</button><div><h1>{storage.name}</h1><StorageStatus value={storage.status} /><Tag className="mock-source-tag">MOCK DATA</Tag></div><p>{storage.description}</p><span>{engineName} {storage.version} · {storage.region} · {storage.nodes.length} Brokers</span></div><div className="storage-console-actions"><Button icon={<ReloadOutlined />}>刷新</Button><Button type="primary" icon={<ApartmentOutlined />} onClick={() => navigate(`/clusters/${clusterId}/topology?node=cluster-${storage.id}`)}>查看拓扑</Button></div></section><nav className="storage-console-tabs" aria-label={`${engineName} 控制台导航`}>{allowedPanels.map((item) => <button key={item} className={item === activePanel ? "active" : ""} onClick={() => navigate(panelPath(item))}>{panelLabels[item]}</button>)}</nav>{panels[activePanel]}<CreateNodeModal open={brokerOpen} onClose={()=>setBrokerOpen(false)} kind="broker" cluster={storage} existingNames={storage.nodes.map((item)=>item.name)} onCreate={addNode}/><CreateTopicModal open={topicOpen} onClose={()=>setTopicOpen(false)} eventMeshClusterId={clusterId} storageClusters={[storage]} fixedStorage={storage} existingNames={topics.map((item)=>item.name)} onCreate={addPhysicalTopic}/></div>;
}
