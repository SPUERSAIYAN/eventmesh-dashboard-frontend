import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PoweroffOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { App as AntApp, Button } from "antd";
import type { MouseEvent, ReactNode } from "react";
import {
  LIFECYCLE_ACTIONS,
  TRANSITIONAL_DEPLOY_STATUSES,
  canUninstall,
  lifecycleLabel,
  lifecycleTone,
  primaryLifecycleAction,
  type DeployStatusType,
  type LifecycleAction,
  type LifecycleResourceKind,
} from "../mock/mockLifecycle";
import { useMockLifecycle } from "../store/mockLifecycleStore";

const ACTION_ICONS: Record<LifecycleAction, ReactNode> = {
  start: <PoweroffOutlined />,
  pause: <PauseCircleOutlined />,
  resume: <PlayCircleOutlined />,
  uninstall: <StopOutlined />,
};

function statusIcon(status: DeployStatusType) {
  const tone = lifecycleTone(status);
  if (TRANSITIONAL_DEPLOY_STATUSES.has(status)) return <LoadingOutlined spin />;
  if (status === "UNINSTALL_SUCCESS") return <StopOutlined />;
  if (tone === "healthy") return <CheckCircleOutlined />;
  if (tone === "warning") return <PauseCircleOutlined />;
  if (tone === "abnormal") return <CloseCircleOutlined />;
  return <PoweroffOutlined />;
}

export function LifecycleStatusBadge({ status, showCode = true, className = "" }: { status: DeployStatusType; showCode?: boolean; className?: string }) {
  return <span className={`lifecycle-status ${lifecycleTone(status)} ${className}`.trim()} title={`DeployStatusType.${status}`}>
    {statusIcon(status)}
    <span><strong>{lifecycleLabel(status)}</strong>{showCode && <small>{status}</small>}</span>
  </span>;
}

type LifecycleActionButtonsProps = {
  kind: LifecycleResourceKind;
  resourceId: string;
  resourceName: string;
  status: DeployStatusType;
  compact?: boolean;
  showUninstall?: boolean;
};

export function LifecycleActionButtons({ kind, resourceId, resourceName, status, compact = false, showUninstall = true }: LifecycleActionButtonsProps) {
  const { modal, message } = AntApp.useApp();
  const { perform } = useMockLifecycle();
  const primaryAction = primaryLifecycleAction(status);
  const transitioning = TRANSITIONAL_DEPLOY_STATUSES.has(status);
  const buttonType = compact ? "link" : "default";

  const run = (action: LifecycleAction, event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const copy = LIFECYCLE_ACTIONS[action];
    const subject = kind === "cluster" ? "集群" : "Runtime";
    const destructive = action === "uninstall";
    modal.confirm({
      title: `${copy.label}${subject}？`,
      content: destructive
        ? `${resourceName} 注销后将停止服务，并进入 UNINSTALL → UNINSTALL_ING → UNINSTALL_SUCCESS。此模拟操作不会删除后端数据。`
        : `${resourceName} 将进入 ${copy.pending}，随后流转为 ${copy.running} 和 ${copy.success}。`,
      okText: copy.label,
      cancelText: "取消",
      okButtonProps: { danger: destructive },
      onOk: () => {
        if (perform({ kind, id: resourceId, name: resourceName, action, currentStatus: status })) {
          message.success(`${copy.label}操作已提交`);
        }
      },
    });
  };

  if (transitioning) return <Button type={buttonType} loading disabled>处理中</Button>;
  if (status === "UNINSTALL_SUCCESS") return compact ? null : <Button disabled icon={<StopOutlined />}>已注销</Button>;

  return <span className={`lifecycle-actions ${compact ? "compact" : ""}`.trim()}>
    {primaryAction && <Button type={buttonType} icon={ACTION_ICONS[primaryAction]} onClick={(event) => run(primaryAction, event)}>{LIFECYCLE_ACTIONS[primaryAction].label}</Button>}
    {showUninstall && canUninstall(status) && <Button type={buttonType} danger icon={ACTION_ICONS.uninstall} onClick={(event) => run("uninstall", event)}>注销</Button>}
  </span>;
}
