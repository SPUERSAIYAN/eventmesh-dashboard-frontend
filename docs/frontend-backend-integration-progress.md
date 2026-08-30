# EventMesh 查询接口对接进度表

> 更新时间：2026-08-30  
> 基线文档：[`page-metadata-controller-mapping.md`](./page-metadata-controller-mapping.md)  
> 接口统一前缀：`/eventmesh/dashboard`

本文只记录**查询接口**的前后端对接进度，不包含创建、修改、删除、部署、复制、暂停、恢复等写操作。

## 1. 状态定义

| 状态 | 判断标准 |
| --- | --- |
| ✅ 已对接 | 当前生效页面真实调用接口，响应解析和页面展示均已验证 |
| 🟡 部分对接 | 页面使用了部分查询结果，其余展示仍来自 Mock 或尚未展示 |
| 🔵 接口就绪 | 前端 Repository 已实现且接口实测成功，但当前生效页面尚未调用 |
| 🟠 待验证 | 前端已有调用代码，但缺少有效业务数据或未完成页面验证 |
| ⚪ 未接入 | 后端查询接口存在，前端当前没有调用 |
| 🔴 后端不完整 | Controller 没有返回有效数据、返回 `void`，或查询协议存在明显问题 |

## 2. 查询接口总体进度

| 统计项 | 当前结果 |
| --- | --- |
| 当前页面已真实调用 | 3 个：首页集群、Runtime 列表、集群拓扑查询 |
| 已通过前端代理实测成功 | 8 个查询接口 |
| 当前页面部分使用 | 首页集群查询和集群拓扑查询；拓扑当前只用于统计 Meta 节点 |
| 当前页面完整使用 | Runtime 列表查询已用于各集群节点计数和首页汇总 |
| Repository 已实现但页面未使用 | 通用集群列表、Topic、Consumer Group、操作日志、配置等查询 |
| 当前结论 | 首页基础字段、Runtime 数量和可确认的 Meta 节点数量已使用 Live 查询；资源指标和消息速率没有可靠来源，统一显示 `—` |

## 3. 首页集群查询接口

### 3.1 接口信息

```http
POST /eventmesh/dashboard/user/cluster/queryVisualizationClusterByOrganizationIdAndType
Content-Type: application/json
```

当前前端请求体：

```json
{
  "organizationId": 1,
  "clusterType": "EVENTMESH_JVM_CLUSTER"
}
```

### 3.2 查询条件

| 请求字段 | 是否必填 | 当前值 | 作用 | 当前限制 |
| --- | --- | --- | --- | --- |
| `organizationId` | 后端 DTO 未标记必填 | `1` | 查询指定组织下的集群 | 当前前端固定为组织 `1`，尚未支持组织切换 |
| `clusterType` | 是 | `EVENTMESH_JVM_CLUSTER` | 按集群类型过滤 | 当前首页只查询 EventMesh JVM 集群 |
| `clusterName` | 否 | 未传 | DTO 预留的集群名称条件 | 当前 Mapper SQL 没有使用该字段，暂时不能按名称过滤 |

后端当前实际 SQL 条件只有：

```sql
select *
from cluster
where organization_id = #{organizationId}
  and cluster_type = #{clusterType}
```

接口不会根据 `status`、`is_delete`、部署状态或集群名称继续过滤。

### 3.3 可以查询到的内容

该接口查询 `cluster` 表中的集群基础信息、部署信息、托管信息和配置，不查询 Runtime、Topic、Consumer Group 或监控指标。

| 数据分类 | 返回字段 | 字段作用 |
| --- | --- | --- |
| 标识 | `id` | 集群数据库主键 |
|  | `organizationId` | 所属组织 ID |
|  | `clusterId` | 上级/关联集群标识；当前返回数据中可为空 |
|  | `clusterType` | 集群类型 |
| 基础信息 | `name` | 集群名称 |
|  | `version` | EventMesh/集群版本 |
|  | `description` | 集群描述 |
| 托管与归属 | `trusteeshipType` | 托管、自维护等托管方式 |
|  | `clusterOwnType` | 独占、组织共享等归属方式 |
|  | `firstToWhom` | 第一次元数据同步的主导方 |
|  | `firstSyncState` | 第一次同步结果 |
| 部署信息 | `deployStatusType` | 创建、运行、暂停、卸载等部署状态 |
|  | `createMethod` | 集群创建方式；当前可能为空 |
|  | `resourcesConfigId` | 资源规格 ID |
|  | `deployScriptId` | 部署脚本 ID |
|  | `deployScriptName` | 部署脚本名称 |
|  | `deployScriptVersion` | 部署脚本版本 |
|  | `runtimeIndex` | Runtime 编号/分配索引 |
| 架构与同步 | `replicationType` | 主从或复制架构类型 |
|  | `syncErrorType` | 元数据同步异常类型 |
| 扩展配置 | `config` | JSON 字符串，当前包含地域、云厂商、Kubernetes 集群等 |
|  | `jmxProperties` | JMX 配置 |
|  | `authType` | 认证类型 |
| 时间 | `onlineTimestamp` | 上线时间 |
|  | `offlineTimestamp` | 下线时间 |
|  | `startTimestamp` | 启动时间；当前可能为空 |
|  | `createTime` | 数据创建时间 |
|  | `updateTime` | 数据更新时间 |
| 数据状态 | `status` | 数据有效状态 |
|  | `isDelete` | 逻辑删除标记 |
| 审计 | `createUserId` | 创建用户 ID |
|  | `updateUserId` | 更新用户 ID |

`config` 示例：

```json
{
  "region": "华东 1（杭州）",
  "cloudProvider": "Alibaba Cloud ACK",
  "kubernetesCluster": "ack-prod-east-01"
}
```

### 3.4 当前前端已经使用的查询结果

| 后端字段 | 前端展示内容 | 对接状态 |
| --- | --- | --- |
| `id` | 集群标识和列表行标识 | ✅ 已使用 |
| `name` | 集群名称 | ✅ 已使用 |
| `description` | 集群描述 | ✅ 已使用 |
| `version` | 集群版本 | ✅ 已使用 |
| `clusterType` | 集群类型 | ✅ 已解析，页面未重点展示 |
| `deployStatusType` | 运行中、已暂停等部署状态 | ✅ 已使用 |
| `trusteeshipType` | 托管、自维护 | ✅ 已使用 |
| `config.region` | 地域 | ✅ 已使用 |
| `config.cloudProvider` | 云厂商/托管环境 | ✅ 已使用 |
| `config.kubernetesCluster` | Kubernetes 集群名称 | ✅ 已使用 |
| `clusterOwnType` | 集群归属/共享方式 | ⚪ 尚未展示 |
| `replicationType` | 复制架构 | ⚪ 尚未展示 |
| `firstToWhom`、`firstSyncState` | 同步主导方和同步结果 | ⚪ 尚未展示 |
| 部署脚本相关字段 | 部署脚本信息 | ⚪ 尚未展示 |
| `resourcesConfigId` | 资源规格引用 | ⚪ 尚未展示 |
| `onlineTimestamp`、`offlineTimestamp` | 上下线时间 | ⚪ 尚未展示 |
| `authType`、`jmxProperties` | 认证和 JMX 信息 | ⚪ 尚未展示 |
| 审计字段 | 创建/更新时间和操作人 | ⚪ 尚未展示 |

### 3.5 该接口不能查询的内容

以下内容不在 `cluster` 查询结果中，需要其他查询接口提供：

| 内容 | 对应查询接口 | 当前页面情况 |
| --- | --- | --- |
| Runtime 节点列表 | `POST /runtime/queryRuntimeListByClusterId` | ✅ 已用于每个集群的 Runtime 数量和首页总数 |
| Topic 列表和数量 | `POST /user/topic/queryTopicListByClusterId` | 当前首页未使用 |
| Consumer Group 列表和数量 | `POST /user/group/queryGroupListByClusterId` | 当前首页未使用 |
| 集群拓扑和关联集群 | `POST /user/cluster/queryTreeByClusterId` | 🟡 首页已用于统计 Meta 子节点；详情拓扑仍为 Mock |
| 配置项明细 | `POST /user/config/queryByInstanceId` | 当前首页未使用 |
| 操作日志 | `POST /cluster/log/getList` | 当前首页未使用 |
| CPU、内存、磁盘使用率 | 当前 Controller 合同没有对应查询结果 | 当前为 Mock |
| 消息流入/流出速率 | Report/监控查询接口待联调 | 当前为 Mock |
| 健康历史和可用率 | Health 查询接口 | 当前为 Mock |

### 3.6 实测结果

| 项目 | 结果 |
| --- | --- |
| HTTP 状态 | `200` |
| 业务码 | `200` |
| 业务消息 | `执行成功` |
| 返回数量 | 3 个集群 |
| 页面展示 | 3 个 Live 集群，2 个运行中、1 个已暂停；Runtime 总数 6 |
| 响应解析 | 正常 |
| 加载状态 | 正常 |
| 错误状态 | 已提供接口失败提示和重试按钮 |
| 手动刷新 | 已支持 |
| 前端控制台错误 | 未发现 |
| 综合状态 | 🟡 部分对接；基础字段、Runtime 数和 Meta 节点数已接入 |

当前返回的集群：

| ID | 名称 | 版本 | 部署状态 | 地域 |
| ---: | --- | --- | --- | --- |
| `1001` | `prod-eventmesh-east` | `1.11.0` | `CREATE_SUCCESS` | 华东 1（杭州） |
| `1002` | `prod-eventmesh-south` | `1.11.0` | `CREATE_SUCCESS` | 华南 1（深圳） |
| `1003` | `staging-eventmesh` | `1.10.2` | `PAUSE_SUCCESS` | 华东 2（上海） |

当前节点查询结果：

| 集群 ID | Runtime 节点 | Meta 节点 | 查询口径 |
| ---: | ---: | ---: | --- |
| `1001` | 3 | 2 | Runtime 列表计数；Meta 拓扑子节点计数 |
| `1002` | 2 | 2 | Runtime 列表计数；Meta 拓扑子节点计数 |
| `1003` | 1 | — | Meta 集群存在，但当前拓扑未返回其子节点，不能按 `0` 处理 |
| **合计** | **6** | **至少 4** | 首页只汇总展示 Runtime；Meta 仅展示后端能够明确确认的节点数 |

首页不会再按集群名称匹配 Mock 指标。当前没有可靠接口来源的平均 CPU、平均内存、流入速率和流出速率均显示 `—`；拓扑缺少 Meta 子节点列表时同样显示 `—`，不把“未知”解释成零。

## 4. 已实测查询接口进度

以下查询均通过前端 Vite 代理实测，测试数据使用组织 `1`、集群 `1001`。返回数量只代表本次测试数据，不代表接口固定数量。

| 页面/数据 | 查询接口 | HTTP/业务码 | 返回数量 | Repository | 当前生效页面使用 | 进度 |
| --- | --- | --- | ---: | --- | --- | --- |
| 首页集群 | `POST /user/cluster/queryVisualizationClusterByOrganizationIdAndType` | `200/200` | 3 | 已实现 | 是，使用部分字段 | 🟡 部分对接 |
| 通用集群列表 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `200/200` | 3 | 已实现 | 否 | 🔵 接口就绪 |
| Runtime 列表 | `POST /runtime/queryRuntimeListByClusterId` | `200/200` | 集群 `1001` 返回 3 | 已实现 | 是，用于节点计数 | ✅ 已对接 |
| Topic 列表 | `POST /user/topic/queryTopicListByClusterId` | `200/200` | 2 | 已实现 | 否 | 🔵 接口就绪 |
| Consumer Group 列表 | `POST /user/group/queryGroupListByClusterId` | `200/200` | 3 | 已实现 | 否 | 🔵 接口就绪 |
| 操作日志 | `POST /cluster/log/getList` | `200/200` | 3 | 已实现 | 否 | 🔵 接口就绪 |
| 集群拓扑 | `POST /user/cluster/queryTreeByClusterId` | `200/200` | 集群 `1001` 返回 3 个关联集群 | 已实现 | 是，用于 Meta 节点计数 | 🟡 部分对接 |
| 集群配置 | `POST /user/config/queryByInstanceId` | `200/200` | 0 | 已实现 | 否 | 🟠 链路正常，缺少非空数据验证 |

## 5. 已编码但尚未实测的查询接口

| 查询内容 | 接口 | 前端代码 | 未完成原因 | 进度 |
| --- | --- | --- | --- | --- |
| Runtime 详情 | `POST /runtime/queryRuntimeListById` | Repository 已实现 | 需要使用真实 Runtime ID 验证对象结构 | 🟠 待验证 |
| Topic 对应 Group | `POST /user/group/queryGroupListByTopicId` | Repository 已实现 | 需要使用真实 Topic ID 验证关联结果 | 🟠 待验证 |

## 6. 后端存在但前端未接入的查询接口

| 页面/数据 | 查询接口 | 当前问题 | 进度 |
| --- | --- | --- | --- |
| 集群首页统计 | `GET /user/cluster/queryHomeClusterData` | 使用 `GET + RequestBody`，且 Mapper SQL 当前为空 | 🔴 后端不完整 |
| 集群详情 | `POST /user/cluster/queryClusterDetails` | 当前返回空的 `ClusterDetailsVO` | 🔴 后端不完整 |
| 集群关系 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | 前端关系页面仍使用 Mock | ⚪ 未接入 |
| Meta 详情 | `POST /organization/details/meta` | Controller 未返回完整详情数据 | 🔴 后端不完整 |
| Storage 详情 | `POST /organization/details/storage` | Controller 未返回完整详情数据 | 🔴 后端不完整 |
| Runtime 健康历史 | `GET /cluster/health/getHistoryLiveStatus` | 前端监控页面仍使用 Mock | ⚪ 未接入 |
| Runtime 可用率 | `GET /cluster/health/getInstanceLiveProportion` | 前端监控页面仍使用 Mock | ⚪ 未接入 |
| 客户端概览指标 | `POST /overview/overview` | 指标字段和时间维度尚未验证 | 🟠 待验证 |
| 客户端列表 | `POST /client/queryClientByUserForm` | 页面模型尚未接入 | ⚪ 未接入 |
| 网络连接 | `POST /netConnection` | `NetConnection` 与业务客户端页面模型尚未统一 | ⚪ 未接入 |
| 首页消息报表 | `/report/reportByHome` | 请求方法、返回指标和单位尚未确认 | 🟠 待验证 |
| 单集群消息报表 | `/report/reportBySingle` | 请求方法、返回指标和单位尚未确认 | 🟠 待验证 |
| ACL 查询 | `POST /acl/selectAcl` | Controller 调用 Service，但返回 `void` | 🔴 后端不完整 |

## 7. 查询对接优先顺序

1. 明确 Meta 集群存在但拓扑不返回子节点时的业务口径，避免把“未知”误判为 `0`。
2. 将集群详情页接入已实测成功的 Runtime、Topic、Group、Log 和完整拓扑查询。
3. 恢复 Topic、Consumer Group、Operation 查询页面路由。
4. 使用真实 Runtime ID 和 Topic ID 验证详情及关联查询。
5. 为配置表补充测试数据，验证非空配置展示。
6. 后端补齐集群详情、Meta/Storage 详情和 ACL 查询返回值，并明确 Report 查询合同。

## 8. 查询进度更新规则

- 只有当前生效页面真实发起查询并展示结果，才能标记为“已对接”。
- Repository 已有方法但页面没有调用，只标记为“接口就绪”。
- HTTP 200 但返回空数组，只能说明查询链路正常，仍需非空数据验证。
- 每次验证记录请求条件、HTTP 状态、业务码、返回数量、页面入口和异常状态。
- 页面仍使用 Mock 指标或 Mock 详情时，相关查询最高只能标记为“部分对接”。
