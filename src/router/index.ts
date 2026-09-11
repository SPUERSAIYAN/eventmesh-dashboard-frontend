import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/clusters" },
    { path: "/overview", redirect: "/clusters" },
    { path: "/clusters", name: "clusters", component: () => import("../views/ClusterInventory.vue") },
    { path: "/clusters/:clusterId", redirect: (to) => `/clusters/${encodeURIComponent(String(to.params.clusterId))}/overview` },
    { path: "/clusters/:clusterId/storage/:engine/:storageClusterId/:panel?", name: "storage-console", component: () => import("../views/StorageConsole.vue") },
    { path: "/clusters/:clusterId/:componentType(runtime|meta)/:componentClusterId/:panel?", name: "component-console", component: () => import("../views/ComponentConsole.vue") },
    { path: "/clusters/:clusterId/:view", name: "cluster-detail", component: () => import("../views/ClusterDetail.vue") },
    { path: "/topics", redirect: "/clusters" }, { path: "/groups", redirect: "/clusters" }, { path: "/operations", redirect: "/clusters" },
    { path: "/:pathMatch(.*)*", redirect: "/clusters" },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach((to) => {
  if (to.name === "cluster-detail") {
    const allowed = new Set(["summary", "overview", "topology", "relations", "runtime", "meta", "storage", "topics", "connections", "consumers", "operations", "configuration"]);
    if (!allowed.has(String(to.params.view))) return { path: `/clusters/${encodeURIComponent(String(to.params.clusterId))}/overview`, replace: true };
  }
});
export default router;
