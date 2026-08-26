export const DEPLOY_STATUS_TYPES = [
  "SETTLE",
  "BUILD_SUCCESS",
  "CREATE",
  "CREATE_WAIT",
  "CREATE_ING",
  "CREATE_SUCCESS",
  "CREATE_FAIL",
  "PAUSE",
  "PAUSE_WAIT",
  "PAUSE_ING",
  "PAUSE_SUCCESS",
  "PAUSE_FAIL",
  "RESET",
  "RESET_WAIT",
  "RESET_ING",
  "RESET_SUCCESS",
  "RESET_FAIL",
  "UNINSTALL",
  "UNINSTALL_ING",
  "UNINSTALL_SUCCESS",
  "UNINSTALL_FAIL",
] as const;

export type DeployStatusType = (typeof DEPLOY_STATUS_TYPES)[number];
export type LifecycleAction = "start" | "pause" | "resume" | "uninstall";
export type LifecycleResourceKind = "cluster" | "runtime";

export function isDeployStatus(value: unknown): value is DeployStatusType {
  return typeof value === "string" && (DEPLOY_STATUS_TYPES as readonly string[]).includes(value);
}

export const LIFECYCLE_ACTIONS: Record<LifecycleAction, {
  label: string;
  pending: DeployStatusType;
  running: DeployStatusType;
  success: DeployStatusType;
}> = {
  start: { label: "启动", pending: "CREATE_WAIT", running: "CREATE_ING", success: "CREATE_SUCCESS" },
  pause: { label: "暂停", pending: "PAUSE_WAIT", running: "PAUSE_ING", success: "PAUSE_SUCCESS" },
  resume: { label: "恢复", pending: "RESET_WAIT", running: "RESET_ING", success: "RESET_SUCCESS" },
  uninstall: { label: "注销", pending: "UNINSTALL", running: "UNINSTALL_ING", success: "UNINSTALL_SUCCESS" },
};

export const TRANSITIONAL_DEPLOY_STATUSES = new Set<DeployStatusType>([
  "CREATE",
  "CREATE_WAIT",
  "CREATE_ING",
  "PAUSE",
  "PAUSE_WAIT",
  "PAUSE_ING",
  "RESET",
  "RESET_WAIT",
  "RESET_ING",
  "UNINSTALL",
  "UNINSTALL_ING",
]);

const RUNNING_STATUSES = new Set<DeployStatusType>(["CREATE_SUCCESS", "RESET_SUCCESS"]);
const PAUSED_STATUSES = new Set<DeployStatusType>(["PAUSE_SUCCESS"]);
const READY_STATUSES = new Set<DeployStatusType>(["SETTLE", "BUILD_SUCCESS", "CREATE_FAIL", "RESET_FAIL"]);

export function primaryLifecycleAction(status: DeployStatusType): Exclude<LifecycleAction, "uninstall"> | null {
  if (TRANSITIONAL_DEPLOY_STATUSES.has(status) || status === "UNINSTALL_SUCCESS") return null;
  if (RUNNING_STATUSES.has(status) || status === "PAUSE_FAIL") return "pause";
  if (PAUSED_STATUSES.has(status)) return "resume";
  if (READY_STATUSES.has(status)) return "start";
  return null;
}

export function canUninstall(status: DeployStatusType) {
  return !TRANSITIONAL_DEPLOY_STATUSES.has(status) && status !== "UNINSTALL_SUCCESS";
}

export function lifecycleTone(status: DeployStatusType): "healthy" | "warning" | "abnormal" | "unknown" {
  if (RUNNING_STATUSES.has(status)) return "healthy";
  if (PAUSED_STATUSES.has(status) || TRANSITIONAL_DEPLOY_STATUSES.has(status)) return "warning";
  if (status.endsWith("FAIL") || status === "UNINSTALL_SUCCESS") return "abnormal";
  return "unknown";
}

export function lifecycleLabel(status: DeployStatusType) {
  if (status === "SETTLE" || status === "BUILD_SUCCESS") return "待启动";
  if (status === "CREATE" || status === "CREATE_WAIT") return "等待启动";
  if (status === "CREATE_ING") return "启动中";
  if (status === "CREATE_SUCCESS" || status === "RESET_SUCCESS") return "运行中";
  if (status === "PAUSE" || status === "PAUSE_WAIT") return "等待暂停";
  if (status === "PAUSE_ING") return "暂停中";
  if (status === "PAUSE_SUCCESS") return "已暂停";
  if (status === "RESET" || status === "RESET_WAIT") return "等待恢复";
  if (status === "RESET_ING") return "恢复中";
  if (status === "UNINSTALL") return "等待注销";
  if (status === "UNINSTALL_ING") return "注销中";
  if (status === "UNINSTALL_SUCCESS") return "已注销";
  return "操作失败";
}

export function seedDeployStatus(kind: LifecycleResourceKind, resourceId: string): DeployStatusType {
  if (kind === "cluster") {
    if (resourceId === "staging-eventmesh") return "PAUSE_SUCCESS";
    if (resourceId === "edge-eventmesh-north") return "SETTLE";
    return "CREATE_SUCCESS";
  }
  if (resourceId === "codex-sim-runtime-edge-02") return "PAUSE_SUCCESS";
  if (resourceId.includes("new")) return "SETTLE";
  return "CREATE_SUCCESS";
}

export function statusAfterInterruptedTransition(status: DeployStatusType): DeployStatusType {
  const action = Object.values(LIFECYCLE_ACTIONS).find((item) => item.pending === status || item.running === status);
  return action?.success ?? status;
}

export function lifecycleHealthStatus(status: DeployStatusType) {
  return RUNNING_STATUSES.has(status) ? "Healthy" : status === "UNINSTALL_SUCCESS" ? "Unknown" : "Warning";
}
