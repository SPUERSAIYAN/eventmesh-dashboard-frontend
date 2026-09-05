import { apiClient } from "./client.ts";
import { apiConfig } from "./config.ts";
import { parseObject } from "./contracts.ts";
import { z } from "zod";

export const clusterLifecycleActions = {
  pause: { endpoint: "pauseCluster", status: "PAUSE" },
  resume: { endpoint: "resumeCluster", status: "RESET" },
  uninstall: { endpoint: "uninstallCluster", status: "UNINSTALL" },
} as const;
export type ClusterLifecycleAction = keyof typeof clusterLifecycleActions;
const receiptSchema = z.object({
  clusterId: z.union([z.number().int().positive(), z.string().regex(/^[1-9]\d*$/)]),
  deployStatusType: z.enum(["PAUSE", "RESET", "UNINSTALL"]),
  runtimeCount: z.number().int().nonnegative(),
});

export async function submitClusterLifecycle(clusterId: string, action: ClusterLifecycleAction, client = apiClient) {
  if (!/^[1-9]\d*$/.test(clusterId) || !Object.hasOwn(clusterLifecycleActions, action)) {
    throw new Error("Invalid cluster ID or lifecycle action");
  }
  const operation = clusterLifecycleActions[action];
  const response = await client.post(`/organization/clusterCycleDeploy/${operation.endpoint}`, {
    organizationId: apiConfig.organizationId,
    clusterId,
  });
  const receipt = parseObject(receiptSchema, response.data, "Cluster lifecycle");
  if (String(receipt.clusterId) !== clusterId || receipt.deployStatusType !== operation.status) {
    throw new Error("Cluster lifecycle response does not match the request");
  }
  return receipt;
}
