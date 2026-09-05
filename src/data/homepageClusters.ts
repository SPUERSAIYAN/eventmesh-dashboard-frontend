const TRUSTEESHIP_LABELS = Object.freeze({
  TRUSTEESHIP: "托管",
  SELF: "自维护",
  NO_TRUSTEESHIP: "不托管",
  TRUSTEESHIP_FIND: "Meta 托管",
  TRUSTEESHIP_FIND_REVERSE: "集群主导",
  NOT: "未配置",
});

function parseClusterConfig(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function textOrDash(value: unknown) {
  return value == null || String(value).trim() === "" ? "—" : String(value);
}

function unavailableMetricFields() {
  return {
    cpu: null,
    memory: null,
    storage: null,
    inRate: null,
    outRate: null,
    topics: [],
    consumers: [],
  };
}

export function mapHomepageCluster(entity: any, metricMocks: any[] = []) {
  const id = String(entity?.id ?? entity?.clusterId ?? entity?.name ?? "unknown-cluster");
  const name = textOrDash(entity?.name);
  const mock = metricMocks.find((item) => String(item?.id) === id || item?.name === name);
  const config = parseClusterConfig(entity?.config);
  const trusteeshipType = textOrDash(entity?.trusteeshipType);
  const nodeWarnings = Array.isArray(entity?.homepageNodeWarnings) ? entity.homepageNodeWarnings : [];
  const hasRuntimeCount = Number.isFinite(entity?.homepageRuntimeCount);
  const hasMetaNodeCount = Number.isFinite(entity?.homepageMetaNodeCount);
  return {
    id,
    mockRouteId: mock?.id ?? id,
    name,
    description: textOrDash(entity?.description),
    version: textOrDash(entity?.version),
    clusterType: textOrDash(entity?.clusterType),
    backendDeployStatus: textOrDash(entity?.deployStatusType),
    hostingType: TRUSTEESHIP_LABELS[trusteeshipType] ?? trusteeshipType,
    hosting: textOrDash(config.cloudProvider),
    kubernetes: textOrDash(config.kubernetesCluster),
    region: textOrDash(config.region),
    isMock: false,
    metricSource: "unavailable",
    nodeSource: hasRuntimeCount && hasMetaNodeCount ? "live" : nodeWarnings.length ? "partial" : "unavailable",
    nodeWarnings,
    runtimes: hasRuntimeCount ? entity.homepageRuntimeCount : null,
    metaNodes: hasMetaNodeCount ? entity.homepageMetaNodeCount : null,
    raw: entity,
    ...unavailableMetricFields(),
  };
}

export function mapCopiedHomepageCluster(cluster: any) {
  return {
    ...cluster,
    id: String(cluster.id),
    mockRouteId: String(cluster.id),
    backendDeployStatus: "CREATE_SUCCESS",
    isMock: true,
    metricSource: "mock",
    nodeSource: "mock",
  };
}

export function mergeHomepageClusters(entities: any[], metricMocks: any[] = [], copiedClusters: any[] = []) {
  const live = entities.map((entity) => mapHomepageCluster(entity, metricMocks));
  const liveKeys = new Set(live.flatMap((cluster) => [cluster.id, cluster.name]));
  const copied = copiedClusters
    .filter((cluster) => !liveKeys.has(String(cluster.id)) && !liveKeys.has(cluster.name))
    .map(mapCopiedHomepageCluster);
  return { live, all: [...live, ...copied] };
}

export function resolveHomepageDeployStatus(cluster: any, lifecycleStatuses: Record<string, any> = {}) {
  const local = cluster.isMock ? lifecycleStatuses[`cluster:${cluster.id}`]?.status : undefined;
  return {
    value: local ?? cluster.backendDeployStatus,
    simulated: Boolean(local) || Boolean(cluster.isMock),
  };
}
