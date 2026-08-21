import type { ComponentClusterType, ResourceStatus } from "../config/clusterDefinitions";
export type { ComponentClusterType } from "../config/clusterDefinitions";

export type ComponentNode = {
  id: string;
  name: string;
  role: string;
  address: string;
  status: ResourceStatus;
  cpu?: number;
  memory?: number;
  rate?: string;
  latency?: string;
};

export type ComponentCluster = {
  id: string;
  name: string;
  type: ComponentClusterType;
  description: string;
  status: ResourceStatus;
  region: string;
  version: string;
  nodes: ComponentNode[];
};

export type ClusterRelation = {
  id: string;
  eventMeshClusterId: string;
  componentClusterId: string;
  componentType: ComponentClusterType;
  status: "active";
  createdAt: string;
};

export type MockRelationState = {
  version: 1;
  relations: ClusterRelation[];
};

export const MOCK_RELATION_STORAGE_KEY = "eventmesh-mock-component-relations-v1";

const runtimeNode = (index: number, cluster: "east" | "shared" | "edge", status: ComponentNode["status"] = "healthy"): ComponentNode => ({
  id: `codex-sim-runtime-${cluster}-${String(index).padStart(2, "0")}`,
  name: `codex-sim-runtime-${cluster}-${String(index).padStart(2, "0")}`,
  role: "Runtime",
  address: `10.${cluster === "east" ? 18 : cluster === "shared" ? 28 : 38}.1.${10 + index}:10000`,
  status,
  cpu: 35 + index * 3,
  memory: 48 + index * 4,
  rate: `${(18.4 - index * 1.1).toFixed(1)}K/s`,
});

const metaNode = (index: number, cluster: "east" | "shared", status: ComponentNode["status"] = "healthy"): ComponentNode => ({
  id: `codex-sim-meta-${cluster}-${String(index).padStart(2, "0")}`,
  name: `codex-sim-meta-${cluster}-${String(index).padStart(2, "0")}`,
  role: index === 1 ? "Leader" : "Follower",
  address: `10.${cluster === "east" ? 18 : 28}.0.${10 + index}:2379`,
  status,
  latency: `${6 + index} ms`,
});

const brokerNode = (engine: "kafka" | "rocketmq", cluster: string, index: number, status: ComponentNode["status"] = "healthy"): ComponentNode => ({
  id: `codex-sim-${engine}-${cluster}-broker-${String(index).padStart(2, "0")}`,
  name: `codex-sim-${engine}-${cluster}-broker-${String(index).padStart(2, "0")}`,
  role: engine === "kafka" ? "Kafka Broker" : "RocketMQ Broker",
  address: `10.${engine === "kafka" ? 48 : 58}.${cluster === "east" ? 1 : 2}.${10 + index}:${engine === "kafka" ? 9092 : 10911}`,
  status,
});

export const mockComponentClusters: ComponentCluster[] = [
  { id: "codex-sim-runtime-east-primary", name: "codex-sim-runtime-east-primary", type: "runtime", description: "codex-sim: 华东生产接入与路由 Runtime 集群", status: "healthy", region: "华东 1（杭州）", version: "1.11.0", nodes: Array.from({ length: 6 }, (_, index) => runtimeNode(index + 1, "east")) },
  { id: "codex-sim-runtime-shared", name: "codex-sim-runtime-shared", type: "runtime", description: "codex-sim: 多 EventMesh 共享 Runtime 集群", status: "healthy", region: "华东 2（上海）", version: "1.11.0", nodes: Array.from({ length: 4 }, (_, index) => runtimeNode(index + 1, "shared")) },
  { id: "codex-sim-runtime-edge", name: "codex-sim-runtime-edge", type: "runtime", description: "codex-sim: 边缘接入 Runtime 集群", status: "warning", region: "华北 2（北京）", version: "1.10.2", nodes: [runtimeNode(1, "edge"), runtimeNode(2, "edge", "warning"), runtimeNode(3, "edge")] },
  { id: "codex-sim-meta-east-primary", name: "codex-sim-meta-east-primary", type: "meta", description: "codex-sim: 华东主元数据协调集群", status: "healthy", region: "华东 1（杭州）", version: "3.5.12", nodes: Array.from({ length: 3 }, (_, index) => metaNode(index + 1, "east")) },
  { id: "codex-sim-meta-shared", name: "codex-sim-meta-shared", type: "meta", description: "codex-sim: 多 EventMesh 共享元数据集群", status: "healthy", region: "华东 2（上海）", version: "3.5.12", nodes: Array.from({ length: 3 }, (_, index) => metaNode(index + 1, "shared")) },
  { id: "codex-sim-kafka-orders", name: "codex-sim-kafka-orders", type: "kafka", description: "codex-sim: 订单域 Kafka 存储集群", status: "healthy", region: "华东 1（杭州）", version: "3.8.1", nodes: Array.from({ length: 3 }, (_, index) => brokerNode("kafka", "east", index + 1)) },
  { id: "codex-sim-kafka-shared", name: "codex-sim-kafka-shared", type: "kafka", description: "codex-sim: 共享 Kafka 存储集群", status: "warning", region: "华东 2（上海）", version: "3.7.0", nodes: [brokerNode("kafka", "shared", 1), brokerNode("kafka", "shared", 2, "warning"), brokerNode("kafka", "shared", 3)] },
  { id: "codex-sim-rocketmq-primary", name: "codex-sim-rocketmq-primary", type: "rocketmq", description: "codex-sim: 核心交易 RocketMQ 存储集群", status: "healthy", region: "华东 1（杭州）", version: "5.3.1", nodes: Array.from({ length: 4 }, (_, index) => brokerNode("rocketmq", "east", index + 1)) },
  { id: "codex-sim-rocketmq-shared", name: "codex-sim-rocketmq-shared", type: "rocketmq", description: "codex-sim: 共享 RocketMQ 存储集群", status: "healthy", region: "华南 1（深圳）", version: "5.3.1", nodes: Array.from({ length: 3 }, (_, index) => brokerNode("rocketmq", "shared", index + 1)) },
];

const relation = (eventMeshClusterId: string, componentClusterId: string, day: number): ClusterRelation => {
  const component = mockComponentClusters.find((item) => item.id === componentClusterId)!;
  return {
    id: `relation-${eventMeshClusterId}-${componentClusterId}`,
    eventMeshClusterId,
    componentClusterId,
    componentType: component.type,
    status: "active",
    createdAt: `2026-08-${String(day).padStart(2, "0")}T09:30:00+08:00`,
  };
};

export const seedClusterRelations: ClusterRelation[] = [
  relation("prod-eventmesh-east", "codex-sim-runtime-east-primary", 12),
  relation("prod-eventmesh-east", "codex-sim-runtime-shared", 13),
  relation("prod-eventmesh-east", "codex-sim-meta-east-primary", 12),
  relation("prod-eventmesh-east", "codex-sim-meta-shared", 13),
  relation("prod-eventmesh-east", "codex-sim-kafka-orders", 14),
  relation("prod-eventmesh-east", "codex-sim-rocketmq-primary", 14),
  relation("prod-eventmesh-south", "codex-sim-runtime-shared", 15),
  relation("prod-eventmesh-south", "codex-sim-meta-shared", 15),
  relation("prod-eventmesh-south", "codex-sim-rocketmq-shared", 15),
  relation("staging-eventmesh", "codex-sim-runtime-edge", 16),
  relation("staging-eventmesh", "codex-sim-meta-shared", 16),
  relation("staging-eventmesh", "codex-sim-kafka-shared", 16),
  relation("edge-eventmesh-north", "codex-sim-runtime-edge", 17),
  relation("edge-eventmesh-north", "codex-sim-meta-shared", 17),
  relation("edge-eventmesh-north", "codex-sim-rocketmq-shared", 17),
];

export const defaultMockRelationState = (): MockRelationState => ({ version: 1, relations: seedClusterRelations.map((item) => ({ ...item })) });

export function normalizeMockRelationState(value: unknown): MockRelationState {
  if (!value || typeof value !== "object") return defaultMockRelationState();
  const state = value as Partial<MockRelationState>;
  if (state.version !== 1 || !Array.isArray(state.relations)) return defaultMockRelationState();
  const validComponentIds = new Set(mockComponentClusters.map((item) => item.id));
  const unique = new Map<string, ClusterRelation>();
  state.relations.forEach((item) => {
    if (!item || !validComponentIds.has(item.componentClusterId) || !item.eventMeshClusterId) return;
    const component = mockComponentClusters.find((candidate) => candidate.id === item.componentClusterId)!;
    const key = `${item.eventMeshClusterId}:${component.type}:${component.id}`;
    unique.set(key, { ...item, componentType: component.type, status: "active" });
  });
  return { version: 1, relations: [...unique.values()] };
}

export function addClusterRelations(state: MockRelationState, eventMeshClusterId: string, componentClusterIds: string[], createdAt = new Date().toISOString()): MockRelationState {
  const existing = new Set(state.relations.map((item) => `${item.eventMeshClusterId}:${item.componentType}:${item.componentClusterId}`));
  const additions = componentClusterIds.flatMap((componentClusterId) => {
    const component = mockComponentClusters.find((item) => item.id === componentClusterId);
    if (!component) return [];
    const key = `${eventMeshClusterId}:${component.type}:${componentClusterId}`;
    if (existing.has(key)) return [];
    existing.add(key);
    return [{ id: `relation-${eventMeshClusterId}-${componentClusterId}`, eventMeshClusterId, componentClusterId, componentType: component.type, status: "active" as const, createdAt }];
  });
  return { version: 1, relations: [...state.relations, ...additions] };
}

export function removeClusterRelation(state: MockRelationState, relationId: string): MockRelationState {
  return { version: 1, relations: state.relations.filter((item) => item.id !== relationId) };
}

export function inheritClusterRelations(state: MockRelationState, sourceEventMeshId: string, targetEventMeshId: string, createdAt = new Date().toISOString()): MockRelationState {
  const componentIds = state.relations.filter((item) => item.eventMeshClusterId === sourceEventMeshId).map((item) => item.componentClusterId);
  return addClusterRelations(state, targetEventMeshId, componentIds, createdAt);
}
