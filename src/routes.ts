import { isComponentPanel, isStorageEngine } from "./clusterDefinitions";

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

export function storageClusterConsolePath(eventMeshId, engine, storageClusterId, panel = "overview") {
  const normalizedEngine = isStorageEngine(engine) ? engine : "kafka";
  const normalizedPanel = isComponentPanel(normalizedEngine, panel) ? panel : "overview";
  return `/clusters/${encodeURIComponent(String(eventMeshId))}/storage/${normalizedEngine}/${encodeURIComponent(String(storageClusterId))}/${normalizedPanel}`;
}

export function componentClusterConsolePath(eventMeshId, kind, componentClusterId, panel = "overview") {
  const normalizedKind = kind === "meta" ? "meta" : "runtime";
  const normalizedPanel = isComponentPanel(normalizedKind, panel) ? panel : "overview";
  return `/clusters/${encodeURIComponent(String(eventMeshId))}/${normalizedKind}/${encodeURIComponent(String(componentClusterId))}/${normalizedPanel}`;
}
