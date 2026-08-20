import { CheckCircleOutlined, ExclamationCircleOutlined, SettingOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { STATUS_DEFINITIONS, type ResourceStatus } from "../clusterDefinitions";

const STATUS_ICONS: Record<ResourceStatus, ReactNode> = {
  healthy: <CheckCircleOutlined />,
  warning: <ExclamationCircleOutlined />,
  unknown: <SettingOutlined />,
};

type StatusBadgeProps = {
  value?: ResourceStatus | string;
  label?: string;
  icon?: ReactNode;
  className?: string;
};

export function StatusBadge({ value = "unknown", label, icon, className = "mock-status" }: StatusBadgeProps) {
  const normalized: ResourceStatus = value === "healthy" || value === "warning" ? value : "unknown";
  const definition = STATUS_DEFINITIONS[normalized];
  return <span className={`${className} ${definition.className}`} style={normalized === "unknown" ? { color: "#64768a" } : undefined}>{icon ?? STATUS_ICONS[normalized]}{label ?? definition.label}</span>;
}
