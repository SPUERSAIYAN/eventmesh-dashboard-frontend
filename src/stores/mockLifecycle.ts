import { defineStore } from "pinia";
import { LIFECYCLE_ACTIONS, TRANSITIONAL_DEPLOY_STATUSES, isDeployStatus, seedDeployStatus, statusAfterInterruptedTransition } from "../mock/mockLifecycle";

const STORAGE_KEY = "eventmesh-mock-lifecycle-v1";
const timers = new Map<string, number[]>();
function emptyState() { return { version: 1, statuses: {} as Record<string, any>, operations: [] as any[] }; }
function hydrate() {
  if (typeof window === "undefined") return emptyState();
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved || saved.version !== 1 || !saved.statuses || !Array.isArray(saved.operations)) return emptyState();
    const now = new Date().toISOString();
    saved.statuses = Object.fromEntries(Object.entries(saved.statuses).flatMap(([key, item]: any) => isDeployStatus(item?.status) ? [[key, { ...item, status: statusAfterInterruptedTransition(item.status), updatedAt: item.updatedAt || now }]] : []));
    saved.operations = saved.operations.filter((item: any) => item?.resourceId).map((item: any) => item.result === "running" ? { ...item, deployStatus: statusAfterInterruptedTransition(item.deployStatus), result: "success", completedAt: now } : item).slice(0, 200);
    return saved;
  } catch { return emptyState(); }
}

export const useMockLifecycleStore = defineStore("mock-lifecycle", {
  state: hydrate,
  actions: {
    persist() { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state)); },
    statusOf(kind: string, id: string) { return this.statuses[`${kind}:${id}`]?.status ?? seedDeployStatus(kind as any, id); },
    perform(input: { kind: string; id: string; name: string; action: string; currentStatus?: any }) {
      const key = `${input.kind}:${input.id}`;
      const currentStatus = input.currentStatus ?? this.statusOf(input.kind, input.id);
      if (TRANSITIONAL_DEPLOY_STATUSES.has(currentStatus) || currentStatus === "UNINSTALL_SUCCESS") return false;
      const definition = (LIFECYCLE_ACTIONS as any)[input.action];
      const operation = { id: `lifecycle-${Date.now()}`, resourceKind: input.kind, resourceId: input.id, resourceName: input.name, action: input.action, fromStatus: currentStatus, deployStatus: definition.pending, result: "running", createdAt: new Date().toISOString() };
      (timers.get(key) ?? []).forEach(clearTimeout); timers.delete(key);
      this.statuses[key] = { status: definition.pending, updatedAt: operation.createdAt };
      this.operations = [operation, ...this.operations].slice(0, 200); this.persist();
      const advance = (status: string, done = false) => {
        this.statuses[key] = { status, updatedAt: new Date().toISOString() };
        if (done) this.operations = this.operations.map((item: any) => item.id === operation.id ? { ...item, deployStatus: status, result: "success", completedAt: new Date().toISOString() } : item);
        this.persist();
      };
      const running = window.setTimeout(() => advance(definition.running), 420);
      const success = window.setTimeout(() => { advance(definition.success, true); timers.delete(key); }, 1250);
      timers.set(key, [running, success]); return true;
    },
  },
});
