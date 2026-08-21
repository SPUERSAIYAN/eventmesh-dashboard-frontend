export const RESOURCE_STATUSES = ["healthy", "warning", "unknown"] as const;
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number];

export const COMPONENT_CLUSTER_TYPES = ["runtime", "meta", "kafka", "rocketmq"] as const;
export type ComponentClusterType = (typeof COMPONENT_CLUSTER_TYPES)[number];
export type ComponentConsoleKind = Extract<ComponentClusterType, "runtime" | "meta">;
export type StorageEngine = Extract<ComponentClusterType, "kafka" | "rocketmq">;

export const COMPONENT_DEFINITIONS = {
  runtime: {
    label: "Runtime",
    clusterLabel: "Runtime 集群",
    resourceLabel: "Runtime 实例",
    routeSection: "runtime",
    panels: ["overview", "instances", "connections", "topics", "relations"],
    panelLabels: { overview: "概要", instances: "Runtime 实例", connections: "客户端连接", topics: "Topic 与订阅", relations: "关联 EventMesh" },
  },
  meta: {
    label: "Meta",
    clusterLabel: "Meta 集群",
    resourceLabel: "Meta 节点",
    routeSection: "meta",
    panels: ["overview", "nodes", "registry", "relations"],
    panelLabels: { overview: "概要", nodes: "Meta 节点", registry: "注册信息", relations: "关联 EventMesh" },
  },
  kafka: {
    label: "Kafka",
    clusterLabel: "Kafka 集群",
    resourceLabel: "Broker",
    routeSection: "storage",
    panels: ["overview", "brokers", "topics", "groups", "relations"],
    panelLabels: { overview: "概要", brokers: "Broker", topics: "Topic", groups: "消费组", relations: "关联 EventMesh" },
  },
  rocketmq: {
    label: "RocketMQ",
    clusterLabel: "RocketMQ 集群",
    resourceLabel: "Broker",
    routeSection: "storage",
    panels: ["overview", "brokers", "topics", "groups", "relations"],
    panelLabels: { overview: "概要", brokers: "Broker", topics: "Topic", groups: "消费组", relations: "关联 EventMesh" },
  },
} as const satisfies Record<ComponentClusterType, {
  label: string;
  clusterLabel: string;
  resourceLabel: string;
  routeSection: string;
  panels: readonly string[];
  panelLabels: Readonly<Record<string, string>>;
}>;

export const COMPONENT_TYPE_LABELS = Object.fromEntries(
  COMPONENT_CLUSTER_TYPES.map((type) => [type, COMPONENT_DEFINITIONS[type].label]),
) as Record<ComponentClusterType, string>;

export const STATUS_DEFINITIONS: Record<ResourceStatus, { label: string; className: string }> = {
  healthy: { label: "正常", className: "healthy" },
  warning: { label: "需关注", className: "warning" },
  unknown: { label: "状态未知", className: "unknown" },
};

export function isComponentClusterType(value: unknown): value is ComponentClusterType {
  return COMPONENT_CLUSTER_TYPES.includes(value as ComponentClusterType);
}

export function isStorageEngine(value: unknown): value is StorageEngine {
  return value === "kafka" || value === "rocketmq";
}

export function isComponentPanel(type: ComponentClusterType, panel: unknown): panel is string {
  return typeof panel === "string" && (COMPONENT_DEFINITIONS[type].panels as readonly string[]).includes(panel);
}
