function statusTone(value) {
  const status = String(value ?? "Unknown").toLowerCase();
  if (["failed", "failure", "error", "abnormal", "critical", "fatal", "offline", "stopped", "inactive", "disconnected", "0", "false"].some((item) => status.includes(item))) return "error";
  if (["healthy", "running", "online", "success", "started", "normal", "active", "connected", "stable", "1", "true"].some((item) => status.includes(item))) return "healthy";
  if (["warning", "warn", "degraded", "unstable", "partial", "delayed"].some((item) => status.includes(item))) return "warning";
  return "unknown";
}

function directoryStatus(children) {
  const tones = children.map((child) => statusTone(child.status));
  if (tones.includes("error")) return "Error";
  if (tones.includes("warning")) return "Warning";
  if (tones.includes("unknown")) return "Unknown";
  return children.length ? "Healthy" : "Unknown";
}

function topologyNode(node) {
  const directory = node.kind === "group";
  const kind = directory ? "directory" : node.kind;
  const resourceKind = directory ? "directory" : node.kind;
  return {
    ...node,
    key: node.key,
    title: node.name,
    subtitle: directory ? "Runtime" : node.host ? `${node.host}:${node.port ?? "—"}` : node.clusterType,
    kind,
    resourceKind,
    virtual: directory,
    raw: node.raw ?? node,
    children: (node.children ?? []).map(topologyNode),
  };
}

function resourceNode(item, index, kind, language) {
  const zh = language === "zh";
  if (kind === "topic") return {
    key: `topic-${item.id ?? index}`,
    id: item.id ?? index,
    title: item.topicName ?? `${zh ? "主题" : "Topic"} ${index + 1}`,
    subtitle: item.topicType ?? `${item.readQueueNum ?? "—"} / ${item.writeQueueNum ?? "—"} queues`,
    kind,
    resourceKind: kind,
    relation: "RESOURCE_MEMBERSHIP",
    status: item.status,
    virtual: false,
    raw: item,
    children: [],
  };
  return {
    key: `group-${item.id ?? index}`,
    id: item.id ?? index,
    title: item.name ?? `${zh ? "消费组" : "Consumer group"} ${index + 1}`,
    subtitle: Number(item.type) === 0 ? (zh ? "消费者" : "Consumer") : (zh ? "生产者" : "Producer"),
    kind: "group",
    resourceKind: "consumer-group",
    relation: "RESOURCE_MEMBERSHIP",
    status: item.state ?? item.status,
    virtual: false,
    raw: item,
    children: [],
  };
}

function directory(key, title, subtitle, children, directoryType) {
  return {
    key,
    id: null,
    title,
    subtitle,
    kind: "directory",
    resourceKind: "directory",
    directoryType,
    relation: "RESOURCE_DIRECTORY",
    status: directoryStatus(children),
    virtual: true,
    raw: null,
    children,
  };
}

function annotate(node, parentKey = null, path = []) {
  const pathKeys = [...path, node.key];
  return {
    ...node,
    parentKey,
    pathKeys,
    children: (node.children ?? []).map((child) => annotate(child, node.key, pathKeys)),
  };
}

function uniqueNodes(nodes) {
  const seen = new Set();
  return nodes.filter((node) => {
    if (seen.has(node.key)) return false;
    seen.add(node.key);
    return true;
  });
}

export function buildResourceTree({ cluster, topology, runtimes = [], topics = [], groups = [], language = "zh" }) {
  const zh = language === "zh";
  const fallbackTopology = {
    key: `cluster-${cluster.id}`,
    id: cluster.id,
    name: cluster.name,
    kind: "cluster",
    clusterType: cluster.clusterType,
    status: cluster.status,
    version: cluster.version,
    relation: "ROOT",
    children: runtimes.map((runtime) => ({ ...runtime, key: `runtime-${runtime.id}`, name: runtime.name, kind: "runtime", relation: "DIRECT_RUNTIME", children: [] })),
  };
  const root = topologyNode(topology ?? fallbackTopology);
  root.title = cluster.name ?? root.title;
  root.subtitle = cluster.clusterType ?? root.subtitle;

  const topicNodes = uniqueNodes(topics.map((item, index) => resourceNode(item, index, "topic", language)));
  const groupNodes = uniqueNodes(groups.map((item, index) => resourceNode(item, index, "consumer-group", language)));
  const resourceDirectories = [
    directory(`directory-topics-${cluster.id}`, zh ? "主题" : "Topics", `${topicNodes.length}`, topicNodes, "topics"),
    directory(`directory-groups-${cluster.id}`, zh ? "消费组" : "Consumer groups", `${groupNodes.length}`, groupNodes, "groups"),
  ];
  root.children = [
    ...root.children,
    directory(`directory-resources-${cluster.id}`, zh ? "事件资源" : "Event resources", zh ? `${topicNodes.length + groupNodes.length} 个资源` : `${topicNodes.length + groupNodes.length} resources`, resourceDirectories, "resources"),
  ];
  return annotate(root);
}

export function flattenResourceTree(node, result = []) {
  if (!node) return result;
  result.push(node);
  node.children?.forEach((child) => flattenResourceTree(child, result));
  return result;
}

export function findResourceNode(node, key) {
  if (!node || !key) return null;
  if (node.key === key) return node;
  for (const child of node.children ?? []) {
    const match = findResourceNode(child, key);
    if (match) return match;
  }
  return null;
}

export function resourceTreeExpandedKeys(node) {
  return flattenResourceTree(node).filter((item) => item.children?.length).map((item) => item.key);
}

function searchableText(node) {
  return [node.title, node.subtitle, node.id, node.kind, node.resourceKind, node.clusterType, node.host, node.port, node.relation]
    .filter((value) => value != null && value !== "")
    .join(" ")
    .toLocaleLowerCase();
}

export function nodeMatchesResourceFilters(node, filters = {}) {
  if (node.virtual && (filters.kind && filters.kind !== "all" || filters.status && filters.status !== "all")) return false;
  const query = String(filters.query ?? "").trim().toLocaleLowerCase();
  const matchesQuery = !query || searchableText(node).includes(query);
  const matchesKind = !filters.kind || filters.kind === "all" || node.resourceKind === filters.kind;
  const matchesStatus = !filters.status || filters.status === "all" || statusTone(node.status) === filters.status;
  return matchesQuery && matchesKind && matchesStatus;
}

export function filterResourceTree(node, filters = {}) {
  if (!node) return { tree: null, matchCount: 0, expandedKeys: [] };
  let matchCount = 0;
  const expanded = new Set();
  const visit = (item) => {
    const children = (item.children ?? []).map(visit).filter(Boolean);
    const selfMatches = nodeMatchesResourceFilters(item, filters);
    if (selfMatches && !item.virtual) matchCount += 1;
    if (!selfMatches && !children.length) return null;
    if (children.length) expanded.add(item.key);
    return { ...item, children };
  };
  return { tree: visit(node), matchCount, expandedKeys: [...expanded] };
}
