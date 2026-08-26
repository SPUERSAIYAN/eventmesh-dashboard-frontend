import { useSyncExternalStore } from "react";
import {
  LIFECYCLE_ACTIONS,
  TRANSITIONAL_DEPLOY_STATUSES,
  isDeployStatus,
  seedDeployStatus,
  statusAfterInterruptedTransition,
  type DeployStatusType,
  type LifecycleAction,
  type LifecycleResourceKind,
} from "../mock/mockLifecycle";

export type LifecycleOperation = {
  id: string;
  resourceKind: LifecycleResourceKind;
  resourceId: string;
  resourceName: string;
  action: LifecycleAction;
  fromStatus: DeployStatusType;
  deployStatus: DeployStatusType;
  result: "running" | "success";
  createdAt: string;
  completedAt?: string;
};

type LifecycleState = {
  version: 1;
  statuses: Record<string, { status: DeployStatusType; updatedAt: string }>;
  operations: LifecycleOperation[];
};

const STORAGE_KEY = "eventmesh-mock-lifecycle-v1";
const emptyState = (): LifecycleState => ({ version: 1, statuses: {}, operations: [] });
const resourceKey = (kind: LifecycleResourceKind, id: string) => `${kind}:${id}`;

function normalizeState(value: unknown): LifecycleState {
  if (!value || typeof value !== "object") return emptyState();
  const saved = value as Partial<LifecycleState>;
  if (saved.version !== 1 || !saved.statuses || !Array.isArray(saved.operations)) return emptyState();
  const now = new Date().toISOString();
  const statuses = Object.fromEntries(Object.entries(saved.statuses).flatMap(([key, item]) => {
    if (!item || !isDeployStatus(item.status)) return [];
    const status = statusAfterInterruptedTransition(item.status);
    return [[key, { status, updatedAt: TRANSITIONAL_DEPLOY_STATUSES.has(item.status) ? now : item.updatedAt || now }]];
  }));
  const operations = saved.operations.filter((item) => item && isDeployStatus(item.deployStatus) && isDeployStatus(item.fromStatus) && (item.action === "start" || item.action === "pause" || item.action === "resume" || item.action === "uninstall") && (item.resourceKind === "cluster" || item.resourceKind === "runtime") && item.resourceId).map((item) => item.result === "running"
    ? { ...item, deployStatus: statusAfterInterruptedTransition(item.deployStatus), result: "success" as const, completedAt: now }
    : item).slice(0, 200);
  return { version: 1, statuses, operations };
}

function initialState() {
  if (typeof window === "undefined") return emptyState();
  try { return normalizeState(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null")); }
  catch { return emptyState(); }
}

let state = initialState();
const listeners = new Set<() => void>();
const timers = new Map<string, number[]>();
const emit = () => listeners.forEach((listener) => listener());

function commit(next: LifecycleState) {
  state = next;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

function updateStatus(kind: LifecycleResourceKind, id: string, status: DeployStatusType) {
  commit({ ...state, statuses: { ...state.statuses, [resourceKey(kind, id)]: { status, updatedAt: new Date().toISOString() } } });
}

function completeOperation(operationId: string, deployStatus: DeployStatusType) {
  commit({
    ...state,
    operations: state.operations.map((item) => item.id === operationId
      ? { ...item, deployStatus, result: "success", completedAt: new Date().toISOString() }
      : item),
  });
}

function clearResourceTimers(key: string) {
  (timers.get(key) ?? []).forEach((timer) => window.clearTimeout(timer));
  timers.delete(key);
}

export const mockLifecycleStore = {
  getState: () => state,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  statusOf(kind: LifecycleResourceKind, id: string) {
    return state.statuses[resourceKey(kind, id)]?.status ?? seedDeployStatus(kind, id);
  },
  perform(input: { kind: LifecycleResourceKind; id: string; name: string; action: LifecycleAction; currentStatus?: DeployStatusType }) {
    const key = resourceKey(input.kind, input.id);
    const currentStatus: DeployStatusType = input.currentStatus ?? this.statusOf(input.kind, input.id);
    if (TRANSITIONAL_DEPLOY_STATUSES.has(currentStatus) || currentStatus === "UNINSTALL_SUCCESS") return false;
    const definition = LIFECYCLE_ACTIONS[input.action];
    const operationId = `lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();
    clearResourceTimers(key);
    commit({
      ...state,
      statuses: { ...state.statuses, [key]: { status: definition.pending, updatedAt: createdAt } },
      operations: [{ id: operationId, resourceKind: input.kind, resourceId: input.id, resourceName: input.name, action: input.action, fromStatus: currentStatus, deployStatus: definition.pending, result: "running" as const, createdAt }, ...state.operations].slice(0, 200),
    });
    if (typeof window !== "undefined") {
      const runningTimer = window.setTimeout(() => updateStatus(input.kind, input.id, definition.running), 420);
      const successTimer = window.setTimeout(() => {
        updateStatus(input.kind, input.id, definition.success);
        completeOperation(operationId, definition.success);
        timers.delete(key);
      }, 1250);
      timers.set(key, [runningTimer, successTimer]);
    }
    return true;
  },
};

if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = initialState();
    emit();
  });
}

export function useMockLifecycle() {
  const snapshot = useSyncExternalStore(mockLifecycleStore.subscribe, mockLifecycleStore.getState, mockLifecycleStore.getState);
  return {
    state: snapshot,
    statusOf: mockLifecycleStore.statusOf.bind(mockLifecycleStore),
    perform: mockLifecycleStore.perform.bind(mockLifecycleStore),
  };
}
