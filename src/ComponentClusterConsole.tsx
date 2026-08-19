import { useEffect, useMemo, useState } from "react";
import { ApartmentOutlined, AppstoreOutlined, CheckCircleOutlined, CloudServerOutlined, ClusterOutlined, DatabaseOutlined, ExclamationCircleOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, Input, Select, Tag } from "antd";
import ReactECharts from "echarts-for-react";
import { useNavigate, useParams } from "react-router-dom";
import { mockClusters } from "./mockClusterData";
import { MOCK_RELATION_STORAGE_KEY, defaultMockRelationState, mockComponentClusters, normalizeMockRelationState } from "./mockClusterRelations";
import { componentClusterConsolePath } from "./routes";
import { CreateNodeModal } from "./MockResourceCreateModals";
import { useMockWritableResources } from "./mockWritableResources";

const panelConfig = {
  runtime: { panels: ["overview", "instances", "connections", "topics", "relations"], labels: { overview: "概要", instances: "Runtime 实例", connections: "客户端连接", topics: "Topic 与订阅", relations: "关联 EventMesh" } },
  meta: { panels: ["overview", "nodes", "registry", "relations"], labels: { overview: "概要", nodes: "Meta 节点", registry: "注册信息", relations: "关联 EventMesh" } },
};

function readRelations() {
  if (typeof window === "undefined") return defaultMockRelationState().relations;
  try { return normalizeMockRelationState(JSON.parse(window.localStorage.getItem(MOCK_RELATION_STORAGE_KEY) || "null")).relations; }
  catch { return defaultMockRelationState().relations; }
}

function ConsoleStatus({ value }) {
  const healthy = value === "healthy";
  return <span className={`storage-console-status ${healthy ? "healthy" : "warning"}`}>{healthy ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}{healthy ? "正常" : "需关注"}</span>;
}

function ConsoleTable({ title, description, columns, rows, searchPlaceholder, action=null }) {
  const [query, setQuery] = useState("");
  const filtered = rows.filter((row) => row.search.toLowerCase().includes(query.toLowerCase()));
  return <section className="panel storage-resource-panel"><div className="storage-resource-toolbar"><div><h2>{title}</h2><p>{description}</p></div><div><Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} /><Button icon={<ReloadOutlined />}>刷新</Button>{action}</div></div><div className="resource-table-wrap"><table className="resource-table storage-resource-table"><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{filtered.map((row) => <tr key={row.key}>{row.cells.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table>{!filtered.length && <div className="storage-console-empty"><SearchOutlined /><strong>未找到匹配资源</strong><span>请调整搜索条件。</span></div>}</div></section>;
}

function ComponentTrendChart({ kind }) {
  const option = useMemo(() => ({
    animationDuration: 450,
    color: ["#225aa0", "#4cb6d4"], tooltip: { trigger: "axis" },
    legend: { right: 8, top: 0, itemWidth: 18, textStyle: { color: "#5f7388" }, data: kind === "runtime" ? ["流入", "流出"] : ["注册", "发现"] },
    grid: { left: 52, right: 22, top: 42, bottom: 32 },
    xAxis: { type: "category", boundaryGap: false, data: ["09:00", "09:10", "09:20", "09:30", "09:40", "09:50", "10:00", "10:10", "10:20", "10:30", "10:40", "10:50"], axisLine: { lineStyle: { color: "#b9c9d9" } }, axisLabel: { color: "#6b7e92" } },
    yAxis: { type: "value", name: kind === "runtime" ? "K 条/s" : "次/s", splitLine: { lineStyle: { color: "#e5edf5" } }, axisLabel: { color: "#6b7e92" } },
    series: kind === "runtime"
      ? [{ name: "流入", type: "line", smooth: true, symbol: "none", data: [54, 58, 57, 62, 66, 64, 69, 72, 70, 75, 73, 78] }, { name: "流出", type: "line", smooth: true, symbol: "none", data: [47, 49, 51, 55, 57, 56, 61, 63, 62, 66, 65, 69] }]
      : [{ name: "注册", type: "line", smooth: true, symbol: "none", data: [124, 128, 126, 131, 136, 134, 139, 142, 140, 145, 143, 148] }, { name: "发现", type: "line", smooth: true, symbol: "none", data: [86, 91, 89, 94, 98, 96, 101, 104, 102, 108, 106, 111] }],
  }), [kind]);
  return <ReactECharts option={option} style={{ height: 270 }} />;
}

export function MockComponentClusterConsole() {
  const navigate = useNavigate();
  const { clusterId, componentType, componentClusterId, panel } = useParams();
  const { state: writableState, addNode } = useMockWritableResources();
  const [createNodeOpen, setCreateNodeOpen] = useState(false);
  const kind = componentType === "meta" ? "meta" : "runtime";
  const config = panelConfig[kind];
  const activePanel = config.panels.includes(panel) ? panel : "overview";
  const baseComponent = mockComponentClusters.find((item) => item.id === componentClusterId && item.type === kind);
  const component = baseComponent ? { ...baseComponent, nodes: [...baseComponent.nodes, ...writableState.nodes.filter((item) => item.clusterId === baseComponent.id)] } : null;
  const relations = useMemo(readRelations, []);
  useEffect(() => {
    if (panel && !config.panels.includes(panel) && component) navigate(componentClusterConsolePath(clusterId, kind, component.id), { replace: true });
  }, [clusterId, component, config.panels, kind, navigate, panel]);
  if (!component) return <section className="panel storage-console-missing">{kind === "runtime" ? <CloudServerOutlined /> : <DatabaseOutlined />}<h1>未找到{kind === "runtime" ? " Runtime" : " Meta"} 集群</h1><p>该集群不存在，或类型与访问路径不一致。</p><Button type="primary" onClick={() => navigate(`/clusters/${clusterId}/${kind}?section=clusters`)}>返回集群列表</Button></section>;

  const isRuntime = kind === "runtime";
  const kindName = isRuntime ? "Runtime" : "Meta";
  const componentRelations = relations.filter((item) => item.componentClusterId === component.id);
  const healthyNodes = component.nodes.filter((item) => item.status === "healthy").length;
  const runtimeTopics = ["codex-sim-order-created", "codex-sim-payment-status", "codex-sim-inventory-sync", "codex-sim-refund-events"].map((name, index) => ({ name, mode: index % 2 ? "广播订阅" : "集群订阅", subscribers: index + 2, rate: `${(18.6 - index * 2.4).toFixed(1)}K/s`, status: index === 3 ? "warning" : "healthy" }));
  const connections = ["codex-sim-order-gateway", "codex-sim-payment-adapter", "codex-sim-inventory-service", "codex-sim-logistics-connector"].map((name, index) => ({ name, protocol: ["HTTP", "TCP", "HTTP", "MQTT"][index], instance: component.nodes[index % component.nodes.length], count: [238, 164, 126, 92][index], active: index ? `${index * 2 + 1} 秒前` : "刚刚", status: index === 3 ? "warning" : "healthy" }));
  const registeredRuntimeNodes = mockComponentClusters.filter((item) => item.type === "runtime").flatMap((item) => item.nodes.map((node) => ({ ...node, clusterName: item.name }))).slice(0, 8);
  const panelPath = (nextPanel) => componentClusterConsolePath(clusterId, kind, component.id, nextPanel);
  const primaryCell = (icon, name, detail) => <span className="storage-primary-cell">{icon}<span><strong>{name}</strong><small>{detail}</small></span></span>;
  const nodeRows = component.nodes.map((node, index) => ({ key: node.id, search: `${node.name} ${node.address} ${node.role}`, cells: [primaryCell(isRuntime ? <CloudServerOutlined /> : <DatabaseOutlined />, node.name, node.id), node.role, node.address, isRuntime ? `${node.cpu ?? 0}% / ${node.memory ?? 0}%` : node.latency ?? `${7 + index} ms`, isRuntime ? node.rate ?? "0/s" : index === 0 ? "Leader" : "Follower", <ConsoleStatus value={node.status} />] }));
  const connectionRows = connections.map((item) => ({ key: item.name, search: `${item.name} ${item.protocol} ${item.instance.name}`, cells: [primaryCell(<LinkOutlined />, item.name, "前端模拟客户端"), item.protocol, item.instance.name, item.count, item.active, <ConsoleStatus value={item.status} />] }));
  const topicRows = runtimeTopics.map((item) => ({ key: item.name, search: `${item.name} ${item.mode}`, cells: [primaryCell(<AppstoreOutlined />, item.name, "EventMesh Topic"), item.mode, item.subscribers, item.rate, <ConsoleStatus value={item.status} />] }));
  const registryRows = registeredRuntimeNodes.map((node) => ({ key: node.id, search: `${node.name} ${node.clusterName} ${node.address}`, cells: [primaryCell(<CloudServerOutlined />, node.name, node.id), node.clusterName, node.address, "EVENTMESH_RUNTIME", "30 秒", <ConsoleStatus value={node.status} />] }));
  const relationRows = componentRelations.map((relation) => { const eventMesh = mockClusters.find((item) => item.id === relation.eventMeshClusterId); return { key: relation.id, search: `${relation.eventMeshClusterId} ${eventMesh?.description ?? ""}`, cells: [primaryCell(<ClusterOutlined />, eventMesh?.name ?? relation.eventMeshClusterId, eventMesh?.description ?? "复制或外部 EventMesh 集群"), `EventMesh → ${kindName} 集群`, <span className="storage-console-status healthy"><LinkOutlined />关联生效</span>, new Date(relation.createdAt).toLocaleString("zh-CN", { hour12: false }), <Button type="link" onClick={() => navigate(`/clusters/${relation.eventMeshClusterId}/topology`)}>查看拓扑</Button>] }; });

  const overview = <div className="storage-console-overview"><section className="storage-console-metrics">
    {isRuntime ? <><div><span>Runtime 实例</span><strong>{healthyNodes} / {component.nodes.length}</strong><small>正常 / 总数</small></div><div><span>客户端连接</span><strong>12.4K</strong><small>全部实例合计</small></div><div><span>Topic</span><strong>{runtimeTopics.length}</strong><small>{runtimeTopics.reduce((sum, item) => sum + item.subscribers, 0)} 个订阅</small></div><div><span>消息流入</span><strong>78.0K/s</strong><small>前端模拟速率</small></div><div><span>平均 CPU</span><strong>{Math.round(component.nodes.reduce((sum, node) => sum + (node.cpu ?? 0), 0) / component.nodes.length)}%</strong><small>集群资源使用率</small></div></>
      : <><div><span>Meta 节点</span><strong>{healthyNodes} / {component.nodes.length}</strong><small>正常 / 总数</small></div><div><span>Leader</span><strong>1</strong><small>选举状态正常</small></div><div><span>已注册 Runtime</span><strong>{registeredRuntimeNodes.length}</strong><small>来自 3 套集群</small></div><div><span>发现请求</span><strong>111/s</strong><small>前端模拟速率</small></div><div><span>平均延迟</span><strong>8 ms</strong><small>注册与发现请求</small></div></>}
  </section><div className="storage-console-overview-grid"><section className="panel storage-console-chart"><div className="storage-console-section-title"><div><h2>{isRuntime ? "消息处理趋势" : "注册与发现趋势"}</h2><p>{isRuntime ? "最近 2 小时消息流入与流出速率" : "最近 2 小时注册和服务发现请求"}</p></div><Select defaultValue="2h" options={[{ value: "2h", label: "最近 2 小时" }, { value: "24h", label: "最近 24 小时" }]} /></div><ComponentTrendChart kind={kind} /></section><section className="panel storage-console-facts"><div className="storage-console-section-title"><div><h2>集群信息</h2><p>{kindName} 集群的部署与关联信息</p></div>{isRuntime ? <CloudServerOutlined /> : <DatabaseOutlined />}</div><dl><div><dt>集群类型</dt><dd>{kindName}</dd></div><div><dt>版本</dt><dd>{component.version}</dd></div><div><dt>地域</dt><dd>{component.region}</dd></div><div><dt>关联 EventMesh</dt><dd>{componentRelations.length} 个</dd></div><div><dt>{isRuntime ? "接入协议" : "协调模式"}</dt><dd>{isRuntime ? "HTTP · TCP · MQTT" : "Leader / Follower"}</dd></div></dl></section></div><section className="panel storage-console-health"><div className="storage-console-section-title"><div><h2>运行状态</h2><p>{isRuntime ? "实例、连接和订阅的关键检查" : "节点、选举和注册信息的关键检查"}</p></div></div><div><span><CheckCircleOutlined /><small>节点可用性</small><strong>{healthyNodes} / {component.nodes.length}</strong><em>集群可正常服务</em></span><span><CheckCircleOutlined /><small>{isRuntime ? "路由状态" : "Leader 状态"}</small><strong>正常</strong><em>{isRuntime ? "消息路由可用" : "选举保持稳定"}</em></span><span><CheckCircleOutlined /><small>{isRuntime ? "活跃连接" : "注册有效率"}</small><strong>{isRuntime ? "12.4K" : "100%"}</strong><em>{isRuntime ? "连接分布均衡" : "无过期实例"}</em></span><span className="warning"><ExclamationCircleOutlined /><small>{isRuntime ? "订阅积压" : "发现延迟"}</small><strong>{isRuntime ? "8.4K" : "12 ms"}</strong><em>{isRuntime ? "codex-sim-payment-workers" : "P99 需关注"}</em></span></div></section></div>;

  const panels = isRuntime ? {
    overview,
    instances: <ConsoleTable title="Runtime 实例" description={`查看 ${component.name} 中的 EventMesh Runtime 实例`} columns={["Runtime", "角色", "地址", "CPU / 内存", "消息速率", "状态"]} rows={nodeRows} searchPlaceholder="搜索 Runtime 名称或地址" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setCreateNodeOpen(true)}>添加 Runtime</Button>} />,
    connections: <ConsoleTable title="客户端连接" description="连接到当前 Runtime 集群的业务客户端" columns={["客户端", "协议", "Runtime", "连接数", "最近活动", "状态"]} rows={connectionRows} searchPlaceholder="搜索客户端、协议或 Runtime" />,
    topics: <ConsoleTable title="Topic 与订阅" description="当前 Runtime 集群正在处理的 EventMesh Topic 和订阅关系" columns={["Topic", "订阅方式", "订阅方", "消息速率", "状态"]} rows={topicRows} searchPlaceholder="搜索 Topic 或订阅方式" />,
    relations: <ConsoleTable title="关联 EventMesh" description="当前 Runtime 集群被哪些 EventMesh 集群使用" columns={["EventMesh 集群", "关系", "状态", "建立时间", "操作"]} rows={relationRows} searchPlaceholder="搜索 EventMesh 集群" />,
  } : {
    overview,
    nodes: <ConsoleTable title="Meta 节点" description={`查看 ${component.name} 中的协调节点`} columns={["Meta 节点", "角色", "地址", "延迟", "选举角色", "状态"]} rows={nodeRows} searchPlaceholder="搜索 Meta 节点或地址" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setCreateNodeOpen(true)}>添加 Meta 节点</Button>} />,
    registry: <ConsoleTable title="注册信息" description="当前 Meta 集群中注册的 Runtime 实例" columns={["Runtime", "来源集群", "地址", "注册类型", "续约周期", "状态"]} rows={registryRows} searchPlaceholder="搜索 Runtime、集群或地址" />,
    relations: <ConsoleTable title="关联 EventMesh" description="当前 Meta 集群被哪些 EventMesh 集群使用" columns={["EventMesh 集群", "关系", "状态", "建立时间", "操作"]} rows={relationRows} searchPlaceholder="搜索 EventMesh 集群" />,
  };

  return <div className="page storage-cluster-console"><section className="storage-console-hero"><div><button onClick={() => navigate(`/clusters/${clusterId}/${kind}?section=clusters`)}>{kindName} 集群 / 集群列表 /</button><div><h1>{component.name}</h1><ConsoleStatus value={component.status} /><Tag className="mock-source-tag">MOCK DATA</Tag></div><p>{component.description}</p><span>{kindName} {component.version} · {component.region} · {component.nodes.length} {isRuntime ? "Instances" : "Nodes"}</span></div><div className="storage-console-actions"><Button icon={<ReloadOutlined />}>刷新</Button><Button type="primary" icon={<ApartmentOutlined />} onClick={() => navigate(`/clusters/${clusterId}/topology?node=cluster-${component.id}`)}>查看拓扑</Button></div></section><nav className="storage-console-tabs" aria-label={`${kindName} 控制台导航`}>{config.panels.map((item) => <button key={item} className={item === activePanel ? "active" : ""} onClick={() => navigate(panelPath(item))}>{config.labels[item]}</button>)}</nav>{panels[activePanel]}<CreateNodeModal open={createNodeOpen} onClose={()=>setCreateNodeOpen(false)} kind={kind} cluster={component} existingNames={component.nodes.map((item)=>item.name)} onCreate={addNode}/></div>;
}
