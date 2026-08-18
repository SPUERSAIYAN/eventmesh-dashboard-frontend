const clusterViews = new Set(["overview", "topology", "configuration"]);

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
