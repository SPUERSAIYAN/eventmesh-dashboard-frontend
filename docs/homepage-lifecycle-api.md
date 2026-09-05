# 首页集群生命周期接口（2026-09-06）

本次仅接入首页真实集群的暂停、恢复、注销。复制、部署、Mock 副本及其他页面保持原数据来源。

所有请求使用 POST，前缀 `/eventmesh/dashboard/organization/clusterCycleDeploy`。

| 路径 | 写入 deploy_status_type |
| --- | --- |
| `/pauseCluster` | `PAUSE` |
| `/resumeCluster` | `RESET` |
| `/uninstallCluster` | `UNINSTALL` |

请求：`{"organizationId":1,"clusterId":"1001"}`。组织、集群 ID 必须为正整数。
返回业务数据：`{"clusterId":1001,"deployStatusType":"PAUSE","runtimeCount":3}`；沿用现有响应包装。
返回仅确认事务入库，不代表实际资源操作完成。注销不删除记录，也不提前设置 `UNINSTALL_SUCCESS`。

后端锁定组织内的集群及其直属、未删除且启用的 Runtime，校验状态，在同一事务中更新状态与 update_time。
关联共享 Meta、Runtime 集群及存储不递归变更。任一直属 Runtime 不允许该操作时整批拒绝；运行中支持暂停，暂停成功支持恢复，RESET_FAIL 支持恢复重试。注销限稳定或失败状态。
重复/并发操作、状态冲突不会覆盖正在执行的任务；任一写入失败全部回滚。

现有统一异常处理器会将业务异常包装为 HTTP 200 + 非成功业务码，前端同时校验业务码和回执内容，拒绝空响应及不匹配回执。
首页仅使用服务端部署状态，不再读取真实集群的历史浏览器 Mock 覆盖值。提交成功后立即用入库回执更新对应缓存，状态列和操作区显示等待动画；等待/执行期间每 5 秒轮询查询，最终成功或失败状态停止对应动画。刷新失败保留最近确认的数据并提示重试；异常不自动重试写请求。动画尊重减少动态效果的系统设置，不模拟百分比或最终结果。

定时扫描与执行器本次未修改、未启用。当前部署扫描注解仍被注释，正常情况下请求保持待处理状态，不能据此认为已暂停/恢复/注销。

## 验证

- 后端 `ClusterLifecycleServiceTest` 使用独立 H2：覆盖 SQL、事务回滚、并发、组织隔离、状态冲突、三条 HTTP 路径、参数校验；不修改已有开发数据库记录。
- 运行：Java 17 下 `mvn -pl eventmesh-dashboard-console -P lifecycle-tests -Dcheckstyle.skip -Dtest=ClusterLifecycleServiceTest test`。
- `lifecycle-tests` profile 仅覆盖父 POM 的 `testInclude=none`，启用本次测试，不改变默认构建。
- 前端相关测试：`node --test tests/cluster-lifecycle.test.mjs tests/homepage-clusters.test.mjs`。
