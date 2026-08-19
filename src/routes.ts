const clusterViews = new Set(["summary", "overview", "topology", "relations", "runtime", "meta", "storage", "topics", "connections", "consumers", "operations", "messages", "security", "configuration"]);

export function normalizeClusterView(view, legacyTab = null) {
  if (clusterViews.has(view)) return view;
  return legacyTab === "topology" ? "topology" : "overview";
}

export function clusterResourcePath(clusterKey, view = "overview", search = {}) {
  const normalizedView = normalizeClusterView(view);
  const params = search instanceof URLSearchParams ? new URLSearchParams(search) : new URLSearchParams();
  if (!(search instanceof URLSearchParams)) {
    Object.entries(search).forEach(([key, value]) => {
      if (value != null && String(value).length) params.set(key, String(value));
    });
  }
  params.delete("tab");
  if (normalizedView !== "topology") {
    params.delete("node");
    params.delete("q");
    params.delete("component");
    params.delete("status");
    params.delete("mode");
    params.delete("kind");
  }
  const query = params.toString();
  return `/clusters/${encodeURIComponent(String(clusterKey))}/${normalizedView}${query ? `?${query}` : ""}`;
}

const storageEngines = new Set(["kafka", "rocketmq"]);
const storagePanels = new Set(["overview", "brokers", "topics", "groups", "relations"]);

export function storageClusterConsolePath(eventMeshId, engine, storageClusterId, panel = "overview") {
  const normalizedEngine = storageEngines.has(engine) ? engine : "kafka";
  const normalizedPanel = storagePanels.has(panel) ? panel : "overview";
  return `/clusters/${encodeURIComponent(String(eventMeshId))}/storage/${normalizedEngine}/${encodeURIComponent(String(storageClusterId))}/${normalizedPanel}`;
}

const componentKinds = new Set(["runtime", "meta"]);
const componentPanels = {
  runtime: new Set(["overview", "instances", "connections", "topics", "relations"]),
  meta: new Set(["overview", "nodes", "registry", "relations"]),
};

export function componentClusterConsolePath(eventMeshId, kind, componentClusterId, panel = "overview") {
  const normalizedKind = componentKinds.has(kind) ? kind : "runtime";
  const normalizedPanel = componentPanels[normalizedKind].has(panel) ? panel : "overview";
  return `/clusters/${encodeURIComponent(String(eventMeshId))}/${normalizedKind}/${encodeURIComponent(String(componentClusterId))}/${normalizedPanel}`;
}
