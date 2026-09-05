const phases: Record<string, readonly [string, string, boolean]> = {
  PAUSE: ["等待暂停", "Awaiting pause", true],
  PAUSE_WAIT: ["等待暂停", "Awaiting pause", true],
  PAUSE_ING: ["暂停中", "Pausing", false],
  RESET: ["等待恢复", "Awaiting resume", true],
  RESET_WAIT: ["等待恢复", "Awaiting resume", true],
  RESET_ING: ["恢复中", "Resuming", false],
  UNINSTALL: ["等待注销", "Awaiting unregistration", true],
  UNINSTALL_ING: ["注销中", "Unregistering", false],
};

export function homepageLifecycleFeedback(status: string, language = "zh") {
  const phase = phases[status];
  if (!phase) return null;
  const zh = language === "zh";
  return {
    label: phase[zh ? 0 : 1],
    detail: phase[2]
      ? (zh ? "请求已入库，等待后台执行" : "Request saved; awaiting execution")
      : (zh ? "后台执行中，正在同步状态" : "Executing; refreshing status"),
  };
}

export function homepageLifecycleRefetchInterval(rows?: Array<{ deployStatusType?: unknown }>) {
  return rows?.some((row) => homepageLifecycleFeedback(String(row.deployStatusType))) ? 5000 : false;
}

export function applyHomepageLifecycleReceipt<T extends { id?: string | number; clusterId?: string | number; deployStatusType?: unknown }>(
  rows: T[] | undefined,
  receipt: { clusterId: string | number; deployStatusType: string },
): T[] | undefined {
  return rows?.map((row) => String(row.id ?? row.clusterId) === String(receipt.clusterId)
    ? { ...row, deployStatusType: receipt.deployStatusType }
    : row);
}
