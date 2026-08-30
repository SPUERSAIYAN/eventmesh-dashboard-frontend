import { useEffect, useMemo, useState } from "react";
import {
  ApartmentOutlined,
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  CloudServerOutlined,
  ClusterOutlined,
  CrownOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  HddOutlined,
  InboxOutlined,
  LinkOutlined,
  NodeIndexOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  SyncOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Alert, Button, Select, Spin, Tag } from "antd";
import ReactECharts from "echarts-for-react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { storageClusterConsolePath } from "../routes";
import { CreateNodeModal, CreateTopicModal } from "../components/MockResourceCreateModals";
import { COMPONENT_DEFINITIONS, isComponentPanel } from "../config/clusterDefinitions";
import { ResourceTable } from "../components/ResourceTable";
import { StatusBadge } from "../components/StatusBadge";
import { useMockWritableResources } from "../store/mockClusterStore";
import { dashboardRepository } from "../api/dashboardRepository";

function rocketMqNameServers(storage) {
  const liveNameServers = storage.nodes.filter((node) => String(node.clusterType ?? "").toUpperCase().includes("NAMESERVER"));
  if (liveNameServers.length) return liveNameServers.map((node, index) => ({
    ...node,
    routes: "Mock · 4",
    brokers: "Mock",
    lastHeartbeat: "未接入",
    source: "live",
    status: node.status,
    name: node.name ?? `NameServer ${index + 1}`,
  }));
  const subnet = storage.id.includes("shared") ? 62 : 61;
  return Array.from({ length: 3 }, (_, index) => ({
    id: `codex-sim-nameserver-${storage.id.includes("shared") ? "shared" : "primary"}-${index + 1}`,
    name: `codex-sim-nameserver-${index + 1}`,
    address: `10.58.${subnet}.${11 + index}:9876`,
    routes: 4,
    brokers: storage.nodes.length,
    lastHeartbeat: `${4 + index * 2} 秒前`,
    status: "healthy",
    source: "mock",
  }));
}

function rocketMqBrokerNodes(storage) {
  return storage.nodes.filter((node) => !String(node.clusterType ?? "").toUpperCase().includes("NAMESERVER")).map((node, index) => ({
    ...node,
    group: `codex-sim-broker-${String.fromCharCode(97 + Math.floor(index / 2))}`,
    replicaRole: index % 2 === 0 ? "Master" : "Slave",
    brokerId: index % 2,
    syncState: index % 2 === 0 ? "主节点" : "同步完成",
    lag: index % 2 === 0 ? "—" : `${12 + index * 4} ms`,
  }));
}

function rocketMqClients(topics) {
  const topicName = (index) => topics[index % Math.max(topics.length, 1)]?.name ?? "—";
  const producers = ["codex-sim-order-producer", "codex-sim-payment-producer", "codex-sim-logistics-producer"].map((name, index) => ({ name, kind: "Producer", topic: topicName(index), instances: 2 + index, rate: `${(18.4 - index * 3.1).toFixed(1)}K/s`, discovery: "NameServer", status: "healthy" }));
  const consumers = ["codex-sim-trade-consumer", "codex-sim-refund-consumer", "codex-sim-delay-consumer"].map((name, index) => ({ name, kind: "Consumer", topic: topicName(index), instances: 3 + index, rate: `${(14.8 - index * 2.2).toFixed(1)}K/s`, discovery: "NameServer", status: index === 2 ? "warning" : "healthy" }));
  return { producers, consumers, all: [...producers, ...consumers] };
}

function RocketMqDeploymentOverview({ nameServers, brokers, clients }) {
  const brokerGroups = [...new Set<string>(brokers.map((item) => String(item.group)))];
  return <section className="panel rocketmq-deployment-panel">
    <div className="storage-console-section-title"><div><h2>部署模型 · 混合数据</h2><p>Broker 身份来自后端；NameServer、客户端、Broker Group 与主从关系按缺失字段使用 Mock</p></div><NodeIndexOutlined /></div>
    <div className="rocketmq-discovery-strip"><span><SendOutlined /><strong>Producer</strong><small>{clients.producers.length} 组 · 路由发现</small></span><b><ArrowRightOutlined /> 查询 Topic 路由</b><div><CloudServerOutlined /><span><strong>NameServer 集群</strong><small>{nameServers.length} 节点 · 无状态路由注册</small></span></div><b>返回 Broker 地址 <ArrowRightOutlined /></b><span><InboxOutlined /><strong>Consumer</strong><small>{clients.consumers.length} 组 · 订阅发现</small></span></div>
    <div className="rocketmq-broker-anatomy"><div className="rocketmq-anatomy-heading"><strong>Broker 集群</strong><span>{brokerGroups.length} 个 Broker Group · Master / Slave 异步复制</span></div><div>{brokerGroups.map((group) => { const members = brokers.filter((item) => item.group === group); return <article key={group}><header><DatabaseOutlined /><strong>{group}</strong><small>Topic 队列读写单元</small></header><div>{members.map((member) => <span key={member.id} className={member.replicaRole.toLowerCase()}><b>{member.replicaRole}</b><strong>{member.name}</strong><small>{member.address}</small><em>{member.replicaRole === "Master" ? "接收读写" : `${member.lag} 复制延迟`}</em></span>)}</div>{members.length > 1 && <footer><SyncOutlined /> Master → Slave 数据同步</footer>}</article>; })}</div></div>
    <div className="rocketmq-message-path"><span><SendOutlined /><strong>发送消息</strong><small>Producer → Broker Master</small></span><span><SyncOutlined /><strong>副本同步</strong><small>Master → Slave</small></span><span><InboxOutlined /><strong>拉取消息</strong><small>Broker → Consumer</small></span></div>
  </section>;
}

function kafkaControllers(storage) {
  const subnet = storage.id.includes("shared") ? 72 : 71;
  return Array.from({ length: 3 }, (_, index) => ({
    id: `codex-sim-kraft-controller-${storage.id.includes("shared") ? "shared" : "primary"}-${index + 1}`,
    name: `codex-sim-kraft-controller-${index + 1}`,
    role: index === 0 ? "Leader" : "Follower",
    address: `10.48.${subnet}.${11 + index}:9093`,
    nodeId: 100 + index,
    term: 42,
    logEndOffset: 128493 - index * 2,
    lag: index === 0 ? "—" : `${index * 2} records`,
    status: "healthy",
  }));
}

function kafkaBrokerNodes(storage, topics) {
  const brokerCount = Math.max(storage.nodes.length, 1);
  return storage.nodes.map((node, index) => ({
    ...node,
    brokerId: index + 1,
    rack: `cn-hangzhou-${String.fromCharCode(97 + index)}`,
    controllerState: "已连接",
    partitionLeaders: Math.max(0, Math.ceil(topics.reduce((sum, topic) => sum + topic.partitions, 0) / brokerCount) - (index === 2 ? 1 : 0)),
    replicas: topics.reduce((sum, topic) => sum + topic.partitions, 0),
  }));
}

function kafkaPartitions(topics, brokers) {
  if (!brokers.length) return [];
  return topics.flatMap((topic) => Array.from({ length: topic.partitions }, (_, partition) => {
    const leader = brokers[partition % brokers.length];
    const followers = brokers.filter((item) => item.id !== leader.id).slice(0, Math.max(0, topic.replicas - 1));
    return {
      id: `${topic.id}-partition-${partition}`,
      topic: topic.name,
      partition,
      leader: leader.name,
      followers: followers.map((item) => item.name),
      isr: [leader, ...followers].map((item) => item.brokerId).join(", "),
      replicas: [leader, ...followers].map((item) => item.brokerId).join(", "),
      highWatermark: 842190 + partition * 837,
      size: `${(38.4 - (partition % 5) * 3.2).toFixed(1)} GB`,
      status: topic.status,
    };
  }));
}

function kafkaClients(topics) {
  const producers = ["codex-sim-order-producer", "codex-sim-payment-producer", "codex-sim-audit-producer"].map((name, index) => ({ name, kind: "Producer", topic: topics[index % Math.max(topics.length, 1)]?.name ?? "—", instances: 2 + index, rate: `${(21.6 - index * 3.4).toFixed(1)}K/s`, protocol: "Kafka API", status: "healthy" }));
  const consumers = ["codex-sim-order-workers", "codex-sim-payment-workers", "codex-sim-audit-sink"].map((name, index) => ({ name, kind: "Consumer", topic: topics[index % Math.max(topics.length, 1)]?.name ?? "—", instances: 3 + index, rate: `${(17.2 - index * 2.6).toFixed(1)}K/s`, protocol: "Consumer Group", status: index === 1 ? "warning" : "healthy" }));
  return { producers, consumers, all: [...producers, ...consumers] };
}

function KafkaDeploymentOverview({ controllers, brokers, partitions, clients }) {
  return <section className="panel kafka-deployment-panel">
    <div className="storage-console-section-title"><div><h2>KRaft 部署模型 · Mock</h2><p>Broker 身份来自后端；Controller、客户端与分区副本布局为前端模拟</p></div><ApartmentOutlined /></div>
    <div className="kafka-controller-quorum"><div className="kafka-anatomy-heading"><strong>KRaft Controller Quorum</strong><span>Raft 元数据日志复制 · 不依赖 ZooKeeper</span></div><div>{controllers.map((controller) => <article key={controller.id} className={controller.role.toLowerCase()}>{controller.role === "Leader" ? <CrownOutlined /> : <CloudServerOutlined />}<span><b>{controller.role}</b><strong>{controller.name}</strong><small>{controller.address}</small></span><em>Term {controller.term} · Offset {controller.logEndOffset}</em></article>)}</div><footer><SyncOutlined /><strong>Metadata Log Replication (Raft)</strong><span>Controller 选举 · 集群元数据 · 分区 Leader 变更</span></footer></div>
    <div className="kafka-control-link"><NodeIndexOutlined /><span><strong>元数据同步与集群控制</strong><small>Controller Quorum → Kafka Broker Cluster</small></span></div>
    <div className="kafka-data-plane"><aside><SendOutlined /><strong>Producer</strong><small>{clients.producers.length} 组客户端</small><em>写入分区 Leader</em></aside><section><div className="kafka-anatomy-heading"><strong>Kafka Broker Cluster</strong><span>{brokers.length} Broker · {partitions.length} Partition</span></div><div>{brokers.map((broker) => { const leaders = partitions.filter((item) => item.leader === broker.name).slice(0, 2); const followers = partitions.filter((item) => item.followers.includes(broker.name)).slice(0, 1); return <article key={broker.id}><header><DatabaseOutlined /><span><strong>{broker.name}</strong><small>Broker {broker.brokerId} · {broker.rack}</small></span></header><div>{leaders.map((partition) => <span key={`leader-${partition.id}`} className="leader"><b>Leader</b><small>{partition.topic} · P{partition.partition}</small></span>)}{followers.map((partition) => <span key={`replica-${partition.id}`} className="replica"><b>Replica</b><small>{partition.topic} · P{partition.partition}</small></span>)}</div></article>; })}</div></section><aside><InboxOutlined /><strong>Consumer Group</strong><small>{clients.consumers.length} 组客户端</small><em>从分区消费消息</em></aside></div>
    <div className="rocketmq-message-path"><span><SendOutlined /><strong>写入消息</strong><small>Producer → Partition Leader</small></span><span><SyncOutlined /><strong>副本复制</strong><small>Leader → Follower Replica</small></span><span><InboxOutlined /><strong>消费消息</strong><small>Partition → Consumer Group</small></span></div>
  </section>;
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

export function MockStorageClusterConsole() {
  const navigate = useNavigate();
  const { clusterId, engine, storageClusterId, panel } = useParams();
  const { state: writableState, addNode, addPhysicalTopic } = useMockWritableResources();
  const [brokerOpen, setBrokerOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const normalizedEngine = engine === "rocketmq" ? "rocketmq" : "kafka";
  const isKafka = normalizedEngine === "kafka";
  const storageDetailQuery = useQuery({
    queryKey: ["dashboard", `${normalizedEngine}-cluster-detail`, clusterId, storageClusterId],
    queryFn: () => isKafka
      ? dashboardRepository.getKafkaClusterDetail(clusterId, storageClusterId)
      : dashboardRepository.getRocketMqClusterDetail(clusterId, storageClusterId),
    enabled: Boolean(clusterId && storageClusterId),
    retry: false,
    refetchInterval: false,
  });
  const config = COMPONENT_DEFINITIONS[normalizedEngine];
  const activePanel = isComponentPanel(normalizedEngine, panel) ? panel : "overview";
  const liveCluster = storageDetailQuery.data?.data?.cluster;
  const storage = liveCluster ? {
      ...liveCluster,
      type: normalizedEngine,
      status: String(liveCluster.status).toLowerCase() === "healthy" ? "healthy" : String(liveCluster.status).toLowerCase() === "warning" ? "warning" : "unknown",
      nodes: [...(Array.isArray(liveCluster.nodes) ? liveCluster.nodes : []).filter(Boolean).map((node) => ({
        ...node,
        address: node.host ? `${node.host}${node.port == null ? "" : `:${node.port}`}` : "—",
        status: String(node.status).toLowerCase() === "healthy" ? "healthy" : String(node.status).toLowerCase() === "warning" ? "warning" : "unknown",
      })), ...writableState.nodes.filter((item) => item.clusterId === liveCluster.id)],
    } : null;
  useEffect(() => {
    if (panel && !isComponentPanel(normalizedEngine, panel) && storage) navigate(storageClusterConsolePath(clusterId, normalizedEngine, storage.id), { replace: true });
  }, [clusterId, navigate, normalizedEngine, panel, storage]);
  const engineName = isKafka ? "Kafka" : "RocketMQ";
  if (storageDetailQuery.isPending) return <section className="panel storage-console-missing"><Spin/><h1>正在加载 {engineName} 控制面板</h1><p>正在查询集群、Broker、Topic、消费组和关联 EventMesh。</p></section>;
  if (storageDetailQuery.isError) return <section className="panel storage-console-missing"><HddOutlined/><h1>{engineName} 控制面板查询失败</h1><p>{storageDetailQuery.error?.message??"后端接口暂不可用"}</p><Button type="primary" onClick={()=>storageDetailQuery.refetch()}>重试</Button></section>;
  if (!storage) return <section className="panel storage-console-missing"><HddOutlined /><h1>未找到存储集群</h1><p>该集群不存在，或类型与访问路径不一致。</p><Button type="primary" onClick={() => navigate(`/clusters/${clusterId}/storage?section=${normalizedEngine}`)}>返回集群列表</Button></section>;

  const liveTopics = storageDetailQuery.data?.data?.topics ?? [];
  const topics = [...liveTopics.filter(Boolean).map((topic) => ({
      ...topic,
      partitions: topic.partitions ?? 1,
      partitionDisplay: topic.partitions,
      replicas: Number.isFinite(topic.replicas) ? topic.replicas : 1,
      replicaDisplay: Number.isFinite(topic.replicas) ? topic.replicas : null,
      inRate: "Mock · 18.6K/s",
      outRate: "Mock · 15.8K/s",
      storage: "Mock · 482 GB",
      status: "unknown",
      source: "live",
    })), ...writableState.physicalTopics.filter((item) => item.storageClusterId === storage.id).map((item) => ({...item,partitionDisplay:item.partitions,replicaDisplay:item.replicas,inRate:"Mock",outRate:"Mock",storage:"Mock",source:"mock"}))];
  const groups = (storageDetailQuery.data?.data?.groups ?? []).filter(Boolean).map((group) => ({...group,topic:"—",members:"Mock · 3",rate:"Mock · 12.7K/s",lag:"Mock · 1.2K",status:"unknown"}));
  const controllers = isKafka ? kafkaControllers(storage) : [];
  const kafkaBrokers = isKafka ? kafkaBrokerNodes(storage, topics) : [];
  const partitions = isKafka ? kafkaPartitions(topics, kafkaBrokers) : [];
  const kafkaClientGroups = isKafka ? kafkaClients(topics) : { producers: [], consumers: [], all: [] };
  const nameServers = isKafka ? [] : rocketMqNameServers(storage);
  const rocketBrokers = isKafka ? [] : rocketMqBrokerNodes(storage);
  const rocketClients = isKafka ? { producers: [], consumers: [], all: [] } : rocketMqClients(topics);
  const storageRelations = Array.isArray(storage.relatedEventMeshes) ? storage.relatedEventMeshes.filter(Boolean) : [];
  const healthyBrokers = (isKafka ? storage.nodes : rocketBrokers).filter((item) => item.status === "healthy").length;
  const healthyNameServers = nameServers.filter((item) => item.status === "healthy").length;
  const panelPath = (nextPanel) => storageClusterConsolePath(clusterId, normalizedEngine, storage.id, nextPanel);
  const brokerRows = isKafka
    ? kafkaBrokers.map((node, index) => ({ key: node.id, search: `${node.name} ${node.address} ${node.rack}`, cells: [<span className="storage-primary-cell"><DatabaseOutlined /><span><strong>{node.name}</strong><small>{node.id}</small></span></span>, node.brokerId, node.address, node.rack, node.controllerState, node.partitionLeaders, node.replicas, `${38 + index * 5}% / ${52 + index * 4}%`, <StatusBadge value={node.status} className="storage-console-status" />] }))
    : rocketBrokers.map((node, index) => ({ key: node.id, search: `${node.name} ${node.address} ${node.group} ${node.replicaRole}`, cells: [<span className="storage-primary-cell"><DatabaseOutlined /><span><strong>{node.name}</strong><small>{node.id}</small></span></span>, node.group, <span className={`rocketmq-replica-role ${node.replicaRole.toLowerCase()}`}>{node.replicaRole}</span>, node.brokerId, node.address, node.syncState, node.lag, `${38 + index * 5}% / ${52 + index * 4}%`, <StatusBadge value={node.status} className="storage-console-status" />] }));
  const controllerRows = controllers.map((controller) => ({ key: controller.id, search: `${controller.name} ${controller.address} ${controller.role}`, cells: [<span className="storage-primary-cell">{controller.role === "Leader" ? <CrownOutlined /> : <CloudServerOutlined />}<span><strong>{controller.name}</strong><small>{controller.id}</small></span></span>, controller.nodeId, <span className={`rocketmq-replica-role ${controller.role.toLowerCase()}`}>{controller.role}</span>, controller.address, controller.term, controller.logEndOffset, controller.lag, <StatusBadge value={controller.status} className="storage-console-status" />] }));
  const partitionRows = partitions.map((partition) => ({ key: partition.id, search: `${partition.topic} ${partition.partition} ${partition.leader}`, cells: [<span className="storage-primary-cell"><AppstoreOutlined /><span><strong>{partition.topic}</strong><small>Partition {partition.partition}</small></span></span>, partition.partition, partition.leader, partition.replicas, partition.isr, partition.highWatermark, partition.size, <StatusBadge value={partition.status} className="storage-console-status" />] }));
  const kafkaClientRows = kafkaClientGroups.all.map((client) => ({ key: client.name, search: `${client.name} ${client.kind} ${client.topic}`, cells: [<span className="storage-primary-cell">{client.kind === "Producer" ? <SendOutlined /> : <InboxOutlined />}<span><strong>{client.name}</strong><small>{client.kind} Group</small></span></span>, client.kind, client.topic, client.instances, client.rate, client.protocol, <StatusBadge value={client.status} className="storage-console-status" />] }));
  const nameServerRows = nameServers.map((node) => ({ key: node.id, search: `${node.name} ${node.address}`, cells: [<span className="storage-primary-cell"><CloudServerOutlined /><span><strong>{node.name}</strong><small>{node.id}</small></span></span>, node.address, node.brokers, node.routes, node.lastHeartbeat, <StatusBadge value={node.status} className="storage-console-status" />] }));
  const routeRows = rocketBrokers.filter((node) => node.replicaRole === "Master").map((node, index) => ({ key: `route-${node.id}`, search: `${node.group} ${node.name}`, cells: [<span className="storage-primary-cell"><NodeIndexOutlined /><span><strong>{node.group}</strong><small>{node.name}</small></span></span>, topics.length, nameServers.length, `${5 + index * 2} 秒前`, "30 秒", <span className="storage-console-status healthy"><CheckCircleOutlined />路由有效</span>] }));
  const clientRows = rocketClients.all.map((client) => ({ key: client.name, search: `${client.name} ${client.kind} ${client.topic}`, cells: [<span className="storage-primary-cell">{client.kind === "Producer" ? <SendOutlined /> : <InboxOutlined />}<span><strong>{client.name}</strong><small>{client.kind} Group</small></span></span>, client.kind, client.topic, client.instances, client.rate, client.discovery, <StatusBadge value={client.status} className="storage-console-status" />] }));
  const topicRows = topics.map((topic) => ({ key: topic.id, search: topic.name, cells: [<span className="storage-primary-cell"><AppstoreOutlined /><span><strong>{topic.name}</strong><small>{topic.source==="mock"?"Mock 写入":"Live"}</small></span></span>, isKafka?(topic.partitionDisplay??"—"):topic.partitions, isKafka?(topic.replicaDisplay??"—"):topic.replicas, topic.inRate, topic.outRate, topic.storage, isKafka?<span className="storage-console-status unknown">— 健康未接入</span>:<StatusBadge value={topic.status} className="storage-console-status" />] }));
  const groupRows = groups.map((group) => ({ key: group.name, search: `${group.name} ${group.topic}`, cells: [<span className="storage-primary-cell"><TeamOutlined /><strong>{group.name}</strong></span>, group.topic, group.members, group.rate, group.lag, <StatusBadge value={group.status} className="storage-console-status" />] }));
  const relationRows = isKafka
    ? storageRelations.map((eventMesh) => ({ key: eventMesh.id, search: `${eventMesh.name} ${eventMesh.description}`, cells: [<span className="storage-primary-cell"><ClusterOutlined /><span><strong>{eventMesh.name}</strong><small>{eventMesh.description}</small></span></span>, "EventMesh → Kafka", <span className="storage-console-status healthy"><LinkOutlined />后端已关联</span>, "—（后端未返回）", <Button type="link" onClick={() => navigate(`/clusters/${eventMesh.routeId}/topology`)}>查看拓扑</Button>] }))
    : storageRelations.map((eventMesh) => ({ key: eventMesh.id, search: `${eventMesh.name} ${eventMesh.description}`, cells: [<span className="storage-primary-cell"><ClusterOutlined /><span><strong>{eventMesh.name}</strong><small>{eventMesh.description}</small></span></span>, "EventMesh → RocketMQ", <span className="storage-console-status healthy"><LinkOutlined />后端已关联</span>, "—（后端未返回）", <Button type="link" onClick={() => navigate(`/clusters/${eventMesh.routeId}/topology`)}>查看拓扑</Button>] }));

  const kafkaOverview = <div className="storage-console-overview kafka-console-overview">
    <section className="storage-console-metrics kafka-console-metrics"><div><span>KRaft Controller · Mock</span><strong>{controllers.length} / {controllers.length}</strong><small>后端未提供 Controller</small></div><div><span>Broker · Live</span><strong>{healthyBrokers} / {storage.nodes.length}</strong><small>依据部署状态</small></div><div><span>Topic · Live</span><strong>{liveTopics.length}</strong><small>{storageDetailQuery.data?.data?.topicsAvailable?"后端已返回":"查询暂不可用"}</small></div><div><span>消费组 · Live</span><strong>{groups.length}</strong><small>{storageDetailQuery.data?.data?.groupsAvailable?"后端已返回":"查询暂不可用"}</small></div><div><span>消息写入 · Mock</span><strong>78.0K/s</strong><small>后端无吞吐接口</small></div><div><span>存储使用 · Mock</span><strong>61%</strong><small>后端无容量接口</small></div></section>
    <KafkaDeploymentOverview controllers={controllers} brokers={kafkaBrokers} partitions={partitions} clients={kafkaClientGroups} />
    <div className="storage-console-overview-grid"><section className="panel storage-console-chart"><div className="storage-console-section-title"><div><h2>消息读写趋势 · Mock</h2><p>后端暂无 Kafka 吞吐时序接口</p></div><Select defaultValue="2h" options={[{ value: "2h", label: "最近 2 小时" }, { value: "24h", label: "最近 24 小时" }]} /></div><StorageRateChart engine={normalizedEngine} /></section><section className="panel storage-console-facts"><div className="storage-console-section-title"><div><h2>集群信息</h2><p>集群身份为 Live；KRaft 模式与副本策略为 Mock</p></div><HddOutlined /></div><dl><div><dt>Kafka 版本 · Live</dt><dd>{storage.version}</dd></div><div><dt>元数据模式 · Mock</dt><dd>KRaft / Raft</dd></div><div><dt>Controller · Mock</dt><dd>{controllers.length} 节点 · 1 Leader</dd></div><div><dt>副本策略 · Mock</dt><dd>Replication Factor 3</dd></div><div><dt>关联 EventMesh · Live</dt><dd>{storageRelations.length} 个</dd></div></dl></section></div>
    <section className="panel storage-console-health"><div className="storage-console-section-title"><div><h2>运行状态 · 混合数据</h2><p>Broker 部署状态为 Live；Controller、ISR 与积压为 Mock</p></div></div><div><span><CheckCircleOutlined /><small>Controller Quorum · Mock</small><strong>3 / 3</strong><em>前端演示数据</em></span><span><CheckCircleOutlined /><small>Broker 部署 · Live</small><strong>{healthyBrokers} / {storage.nodes.length}</strong><em>非真实存活探测</em></span><span><CheckCircleOutlined /><small>ISR 完整率 · Mock</small><strong>100%</strong><em>后端未提供</em></span><span className="warning"><ExclamationCircleOutlined /><small>消费积压 · Mock</small><strong>8.4K</strong><em>{groups[1]?.name??"示例消费组"}</em></span></div></section>
  </div>;

  const rocketMqOverview = <div className="storage-console-overview rocketmq-console-overview">
    <section className="storage-console-metrics rocketmq-console-metrics"><div><span>NameServer · {nameServers.some((item)=>item.source==="live")?"Live":"Mock"}</span><strong>{healthyNameServers} / {nameServers.length}</strong><small>{nameServers.some((item)=>item.source==="live")?"依据部署状态":"后端未返回 NameServer"}</small></div><div><span>Broker · Live</span><strong>{healthyBrokers} / {rocketBrokers.length}</strong><small>Broker Group 与角色为 Mock</small></div><div><span>Topic · Live</span><strong>{liveTopics.length}</strong><small>{storageDetailQuery.data?.data?.topicsAvailable?"后端已返回":"查询暂不可用"}</small></div><div><span>消费组 · Live</span><strong>{groups.length}</strong><small>{storageDetailQuery.data?.data?.groupsAvailable?"后端已返回":"查询暂不可用"}</small></div><div><span>消息写入 · Mock</span><strong>70.0K/s</strong><small>后端无吞吐接口</small></div><div><span>存储使用 · Mock</span><strong>48%</strong><small>后端无容量接口</small></div></section>
    <RocketMqDeploymentOverview nameServers={nameServers} brokers={rocketBrokers} clients={rocketClients} />
    <div className="storage-console-overview-grid"><section className="panel storage-console-chart"><div className="storage-console-section-title"><div><h2>消息读写趋势 · Mock</h2><p>后端暂无 RocketMQ 吞吐时序接口</p></div><Select defaultValue="2h" options={[{ value: "2h", label: "最近 2 小时" }, { value: "24h", label: "最近 24 小时" }]} /></div><StorageRateChart engine={normalizedEngine} /></section><section className="panel storage-console-facts"><div className="storage-console-section-title"><div><h2>集群信息</h2><p>集群身份为 Live；部署与路由缺失字段为 Mock</p></div><HddOutlined /></div><dl><div><dt>RocketMQ 版本 · Live</dt><dd>{storage.version}</dd></div><div><dt>NameServer · {nameServers.some((item)=>item.source==="live")?"Live":"Mock"}</dt><dd>{nameServers.length} 节点 · 9876</dd></div><div><dt>Broker 模式 · Mock</dt><dd>Master / Slave</dd></div><div><dt>路由注册 · Mock</dt><dd>30 秒心跳</dd></div><div><dt>关联 EventMesh · Live</dt><dd>{storageRelations.length} 个</dd></div></dl></section></div>
    <section className="panel storage-console-health"><div className="storage-console-section-title"><div><h2>运行状态 · 混合数据</h2><p>Broker 部署状态为 Live；主从同步、消费积压与缺失的 NameServer 为 Mock</p></div></div><div><span><CheckCircleOutlined /><small>NameServer · {nameServers.some((item)=>item.source==="live")?"Live":"Mock"}</small><strong>{healthyNameServers} / {nameServers.length}</strong><em>{nameServers.some((item)=>item.source==="live")?"依据部署状态":"前端演示数据"}</em></span><span><CheckCircleOutlined /><small>Broker 部署 · Live</small><strong>{healthyBrokers} / {rocketBrokers.length}</strong><em>非真实存活探测</em></span><span><CheckCircleOutlined /><small>主从同步 · Mock</small><strong>正常</strong><em>后端未提供同步状态</em></span><span className="warning"><ExclamationCircleOutlined /><small>消费积压 · Mock</small><strong>8.4K</strong><em>{groups[1]?.name ?? "示例消费组"}</em></span></div></section>
  </div>;

  const sharedPanels = {
    topics: <ResourceTable title={`${engineName} Topic`} description="Topic 名称、队列数和副本数来自后端；速率、存储量和健康状态为 Mock/未接入" columns={["Topic", isKafka ? "分区 / 队列 · Live" : "读写队列 · Live", "副本 · Live", "写入速率 · Mock", "读取速率 · Mock", "存储量 · Mock", "健康 · 未接入"]} rows={topicRows} searchPlaceholder="搜索 Topic" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setTopicOpen(true)}>创建物理 Topic · Mock</Button>} />,
    groups: <ResourceTable title="消费组" description="消费组名称来自后端；Topic 绑定、实例、速率、积压和健康状态未接入" columns={["消费组 · Live", "订阅 Topic · 未接入", "实例 · Mock", "消费速率 · Mock", "积压 · Mock", "健康 · 未接入"]} rows={groupRows} searchPlaceholder="搜索消费组或 Topic" />,
    relations: <ResourceTable title="关联 EventMesh" description="当前存储集群被哪些 EventMesh 集群使用" columns={["EventMesh 集群", "关系", "状态", "建立时间", "操作"]} rows={relationRows} searchPlaceholder="搜索 EventMesh 集群" />,
  };
  const panels = isKafka ? {
    overview: kafkaOverview,
    controllers: <ResourceTable title="KRaft Controller · Mock" description="后端未提供 Controller Quorum；当前为前端部署模型演示" columns={["Controller", "Node ID", "角色", "监听地址", "Term", "Log End Offset", "复制落后", "状态"]} rows={controllerRows} searchPlaceholder="搜索 Controller、角色或地址" />,
    brokers: <ResourceTable title="Kafka Broker" description="Broker 名称、ID、地址、版本和部署状态来自后端；Rack、Controller 连接、分区承载与资源指标为 Mock" columns={["Broker · Live", "Broker ID · Mock", "地址 · Live", "Rack · Mock", "Controller · Mock", "Leader 分区 · Mock", "副本 · Mock", "CPU / 内存 · Mock", "部署状态 · Live"]} rows={brokerRows} searchPlaceholder="搜索 Broker、Rack 或地址" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setBrokerOpen(true)}>添加 Broker · Mock</Button>} />,
    partitions: <ResourceTable title="分区副本 · Mock" description="后端未提供 Partition Leader、Replica 与 ISR 布局；当前依据 Topic/Broker 生成演示数据" columns={["Topic / Partition", "Partition", "Leader", "Replicas", "ISR", "High Watermark", "存储量", "状态"]} rows={partitionRows} searchPlaceholder="搜索 Topic、Partition 或 Leader Broker" />,
    clients: <ResourceTable title="Kafka 客户端 · Mock" description="后端未提供 Producer / Consumer 客户端连接查询" columns={["客户端组", "类型", "Topic", "实例", "消息速率", "协议", "状态"]} rows={kafkaClientRows} searchPlaceholder="搜索客户端、类型或 Topic" />,
    ...sharedPanels,
  } : {
    overview: rocketMqOverview,
    nameservers: <ResourceTable title="NameServer" description="维护 Broker 路由注册，并为 Producer 与 Consumer 提供 Topic 路由发现" columns={["NameServer", "监听地址", "注册 Broker", "Topic 路由", "最近心跳", "状态"]} rows={nameServerRows} searchPlaceholder="搜索 NameServer 名称或地址" />,
    brokers: <ResourceTable title="RocketMQ Broker" description="Broker 名称、ID、地址、版本和部署状态来自后端；Broker Group、主从角色、同步与资源指标为 Mock" columns={["Broker · Live", "Broker Group · Mock", "副本角色 · Mock", "Broker ID · Mock", "地址 · Live", "同步状态 · Mock", "复制延迟 · Mock", "CPU / 内存 · Mock", "部署状态 · Live"]} rows={brokerRows} searchPlaceholder="搜索 Broker、Broker Group 或地址" action={<Button type="primary" icon={<PlusOutlined/>} onClick={()=>setBrokerOpen(true)}>添加 Broker · Mock</Button>} />,
    routes: <div className="rocketmq-route-stack"><ResourceTable title="路由注册 · Mock" description="后端未提供 Broker 路由注册明细" columns={["Broker Group", "Topic", "NameServer", "最近注册", "心跳周期", "状态"]} rows={routeRows} searchPlaceholder="搜索 Broker Group" /><ResourceTable title="客户端访问 · Mock" description="后端未提供 Producer / Consumer 客户端连接查询" columns={["客户端组", "类型", "Topic", "实例", "消息速率", "发现方式", "状态"]} rows={clientRows} searchPlaceholder="搜索客户端、类型或 Topic" /></div>,
    ...sharedPanels,
  };

  return <div className="page storage-cluster-console"><section className="storage-console-hero"><div><button onClick={() => navigate(`/clusters/${clusterId}/storage?section=${normalizedEngine}`)}>存储集群 / {engineName} 集群 /</button><div><h1>{storage.name}</h1><StatusBadge value={storage.status} className="storage-console-status" /><Tag className="mock-source-tag">LIVE + MOCK</Tag></div><p>{storage.description}</p><span>{engineName} {storage.version} · {storage.region} · {isKafka ? `${controllers.length} Controllers · Mock · ${storage.nodes.length} Brokers · Live` : `${nameServers.length} NameServers · ${nameServers.some((item)=>item.source==="live")?"Live":"Mock"} · ${rocketBrokers.length} Brokers · Live`}</span></div><div className="storage-console-actions"><Button icon={<ReloadOutlined spin={storageDetailQuery.isFetching}/>} onClick={()=>storageDetailQuery.refetch()}>刷新</Button><Button type="primary" icon={<ApartmentOutlined />} onClick={() => navigate(`/clusters/${clusterId}/topology?node=cluster-${storage.id}`)}>查看拓扑</Button></div></section>{storageDetailQuery.data?.meta?.warnings?.length>0&&<Alert className="mock-list-warning" type="warning" showIcon message={`部分 ${engineName} 控制面板数据暂不可用`} description={storageDetailQuery.data.meta.warnings.join("；")}/>}<nav className="storage-console-tabs" aria-label={`${engineName} 控制台导航`}>{config.panels.map((item) => <button key={item} className={item === activePanel ? "active" : ""} onClick={() => navigate(panelPath(item))}>{config.panelLabels[item]}</button>)}</nav>{panels[activePanel]}<CreateNodeModal open={brokerOpen} onClose={()=>setBrokerOpen(false)} kind="broker" cluster={storage} existingNames={storage.nodes.map((item)=>item.name)} onCreate={addNode}/><CreateTopicModal open={topicOpen} onClose={()=>setTopicOpen(false)} eventMeshClusterId={clusterId} storageClusters={[storage]} fixedStorage={storage} existingNames={topics.map((item)=>item.name)} onCreate={addPhysicalTopic}/></div>;
}
