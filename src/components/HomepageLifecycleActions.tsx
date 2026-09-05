import { useRef, useState } from "react";
import { App, Button } from "antd";
import { PauseCircleOutlined, PlayCircleOutlined, StopOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { applyHomepageLifecycleReceipt, homepageLifecycleFeedback } from "../data/homepageLifecycleFeedback";
import { useI18n } from "../i18n";
import { submitClusterLifecycle, type ClusterLifecycleAction } from "../api/clusterLifecycle";

const running = new Set(["CREATE_SUCCESS", "CREATE_FULL_SUCCESS", "CREATE_CAP_UPDATE_SUCCESS", "UPDATE_SUCCESS", "UPDATE_FULL_SUCCESS", "RESET_SUCCESS", "PAUSE_FAIL", "PAUSE_FULL_FAIL"]);
const paused = new Set(["PAUSE_SUCCESS", "PAUSE_FULL_SUCCESS", "RESET_FAIL"]);
const removable = new Set([...running, ...paused, "SETTLE", "BUILD_SUCCESS", "CREATE_FAIL", "CREATE_FULL_FAIL", "CREATE_CAP_UPDATE_FAIL", "UPDATE_FAIL", "UPDATE_FULL_FAIL", "UNINSTALL_FAIL", "UNINSTALL_FAILED", "RESOURCE_APPLY_FAILED", "CHECKING_FAILED"]);

export function HomepageLifecycleActions({ clusterId, name, status }: { clusterId: string; name: string; status: string }) {
  const { language } = useI18n();
  const zh = language === "zh";
  const { modal, message } = App.useApp();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const locked = useRef(false);
  const labels = { pause: zh ? "暂停" : "Pause", resume: zh ? "恢复" : "Resume", uninstall: zh ? "注销" : "Unregister" };
  const primary = running.has(status) ? "pause" : paused.has(status) ? "resume" : null;
  const confirm = (action: ClusterLifecycleAction) => {
    if (locked.current) return;
    locked.current = true;
    modal.confirm({
      title: `${labels[action]} ${name}？`,
      content: zh
        ? `${action === "uninstall" ? "注销执行后集群将停止服务。" : ""}提交后将集群及直属 Runtime 的待处理状态写入后端数据库，等待后台执行。关联的共享组件不随此操作变更。`
        : `${action === "uninstall" ? "The cluster will stop serving once unregistration executes. " : ""}Save a pending operation for this cluster and its directly owned runtimes. Execution happens later; shared linked components are unaffected.`,
      okText: zh ? "确认提交" : "Submit request",
      cancelText: zh ? "取消" : "Cancel",
      okButtonProps: { danger: action === "uninstall" },
      afterClose: () => { locked.current = false; },
      onOk: async () => {
        setPending(true);
        try {
          const receipt = await submitClusterLifecycle(clusterId, action);
          await queryClient.cancelQueries({ queryKey: ["dashboard", "homepage-clusters"] });
          queryClient.setQueryData<Array<{ id?: number | string; deployStatusType?: string }>>(["dashboard", "homepage-clusters"], (rows) =>
            applyHomepageLifecycleReceipt(rows, receipt));
          message.success(zh ? "请求已入库，等待后台执行" : "Request saved; awaiting execution");
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "homepage-clusters"] });
        } catch (error) {
          message.error(`${zh ? "提交未确认成功，请刷新状态后重试。" : "Submission was not confirmed. Refresh before retrying."} ${error instanceof Error ? error.message : ""}`);
          void queryClient.invalidateQueries({ queryKey: ["dashboard", "homepage-clusters"] });
          throw error;
        } finally {
          setPending(false);
        }
      },
    });
  };
  if (pending) return <Button type="link" loading disabled>{zh ? "提交中" : "Submitting"}</Button>;
  const feedback = homepageLifecycleFeedback(status, language);
  if (feedback) return <span key={status} className="homepage-lifecycle-feedback" role="status" aria-live="polite" title={feedback.detail}>
    <span className="homepage-lifecycle-dots" aria-hidden="true"><i /><i /><i /></span>
    <span>{feedback.label}</span>
  </span>;
  if (!removable.has(status)) return <Button type="link" disabled>{status === "UNINSTALL_SUCCESS" ? (zh ? "已注销" : "Unregistered") : (zh ? "操作不可用 / 处理中" : "Unavailable / pending")}</Button>;
  return <span className="lifecycle-actions compact" onClick={(event) => event.stopPropagation()}>
    {primary && <Button type="link" icon={primary === "pause" ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={() => confirm(primary)}>{labels[primary]}</Button>}
    <Button type="link" danger icon={<StopOutlined />} onClick={() => confirm("uninstall")}>{labels.uninstall}</Button>
  </span>;
}
