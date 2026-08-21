# EventMesh 页面、Metadata 操作与 Controller 对照

本文按照前端页面整理 Metadata 操作，并对应后端 `eventmesh-dashboard-console` 中实际存在的 Controller。

- 后端统一上下文为 `/eventmesh/dashboard`，表中的接口路径省略该前缀。
- `已有`：后端源码存在对应接口和调用逻辑。
- `页面未接入`：后端接口存在，但当前前端页面没有调用。
- `页面 Mock`：当前页面只写入前端本地状态。
- 页面名称仅在每组第一行填写，后续空白行属于同一页面。

## 1. 集群页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| 大集群页 | all | 查询 | `ClusterController.queryClusterByOrganizationIdAndType`；`POST /user/cluster/queryClusterByOrganizationIdAndType` | 后端已有；当前页面展示前端 Mock 集群。 |
|  | all | 复制 | `ClusterCycleController.createClusterByCopy`；`POST /organization/clusterCycleDeploy/createClusterByCopy` | 后端已有；当前页面使用本地复制任务，没有接入后端。 |
| 集群页面 | cluster | 查询基础信息 | `ClusterController.queryHomeClusterData`；`GET /user/cluster/queryHomeClusterData` | 后端已有；接口使用 GET + RequestBody，接入前需要联调。 |
|  | cluster | 查询详情 | `ClusterController.queryClusterDetails`；`POST /user/cluster/queryClusterDetails` | **不完整**；当前返回空的 `ClusterDetailsVO`。 |
|  | cluster | 查询拓扑 | `ClusterController.queryTreeByClusterId`；`POST /user/cluster/queryTreeByClusterId` | 后端已有。 |
|  | cluster | 基于 Metadata 创建 | `ClusterCycleController.createClusterByFullMetadata`；`POST /organization/clusterCycleDeploy/createClusterByFullMetadata` | 后端已有；当前页面未开放。 |
|  | cluster | 基于基础数据创建 | `ActiveCreateController.createCluster`；`POST /organization/activeCreate/createCluster` | 后端已有；当前页面未开放。 |
|  | cluster | 基于部署脚本创建 | `ClusterCycleController.createClusterByDeployScript`；`POST /organization/clusterCycleDeploy/createClusterByDeployScript` | 后端已有；当前页面未开放。 |
|  | cluster | 直接复制 | `ClusterCycleController.createClusterByCopy`；`POST /organization/clusterCycleDeploy/createClusterByCopy` | 后端已有；当前页面执行的是 Mock 复制。 |
|  | relationship | 查询关联 | `ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId`；`POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | 后端已有；当前页面关系来自本地 Mock。 |
|  | relationship | 建立关联 | `ClusterRelationshipController.addClusterRelationshipEntry`；`POST /clusterRelationship/addClusterRelationshipEntry` | 后端接口存在但已标记 `@Deprecated`；当前页面调用 `addRelations`。 |
|  | relationship | 解除关联 | `ClusterRelationshipController.relieveRelationship`；`POST /clusterRelationship/relieveRelationship` | 后端接口存在但已标记 `@Deprecated`；当前页面调用 `removeRelation`。 |
|  | runtime | 创建 | `ActiveCreateController.createRuntime`；`POST /organization/activeCreate/createRuntime` | 后端已有；当前“添加节点”只写入前端状态。 |
| Runtime 页面 | runtime | 查询 | `RuntimeController.queryRuntimeListByClusterId`；`POST /runtime/queryRuntimeListByClusterId` | 后端已有。 |
|  | runtime | 创建 | `ActiveCreateController.createRuntime`；`POST /organization/activeCreate/createRuntime` | 后端已有；当前 Runtime 页面为 Mock 新增。 |
|  | runtime | 基于部署脚本创建 | `ClusterCycleController.createRuntimeByDeployScript`；`POST /organization/clusterCycleDeploy/createRuntimeByDeployScript` | 后端已有；当前页面未开放。 |
|  | runtime | 查询健康历史 | `HealthController.getHistoryLiveStatusById`；`GET /cluster/health/getHistoryLiveStatus` | 后端已有；当前页面指标为 Mock。 |
|  | runtime | 查询可用率 | `HealthController.getInstanceLiveProportion`；`GET /cluster/health/getInstanceLiveProportion` | 后端已有；当前页面指标为 Mock。 |

## 2. Meta 页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| Meta 页面 | cluster | 查询集群 | `ClusterController.queryClusterByOrganizationIdAndType`；`POST /user/cluster/queryClusterByOrganizationIdAndType` | 后端已有；按 Meta 集群类型筛选。 |
|  | meta | 查询详情 | `DetailsController.metaDetails`；`POST /organization/details/meta` | **不完整**；Controller 方法没有返回详情数据。 |
|  | relationship | 查询关联 EventMesh | `ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId`；`POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | 后端已有；当前页面使用 Mock 关系。 |
|  | relationship | 建立关联 | `ClusterRelationshipController.addClusterRelationshipEntry`；`POST /clusterRelationship/addClusterRelationshipEntry` | 接口已标记 `@Deprecated`；当前页面使用 Mock。 |
|  | relationship | 解除关联 | `ClusterRelationshipController.relieveRelationship`；`POST /clusterRelationship/relieveRelationship` | 接口已标记 `@Deprecated`；当前页面使用 Mock。 |

## 3. Kafka 与 RocketMQ 存储页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| 存储集群页面 | cluster | 查询集群 | `ClusterController.queryClusterByOrganizationIdAndType`；`POST /user/cluster/queryClusterByOrganizationIdAndType` | 后端已有；按 Kafka 或 RocketMQ 类型筛选。 |
|  | storage | 查询详情 | `DetailsController.storageDetails`；`POST /organization/details/storage` | **不完整**；Controller 方法没有返回详情数据。 |
|  | topic | 查询 | `TopicController.queryTopicListByClusterId`；`POST /user/topic/queryTopicListByClusterId` | 后端已有。 |
|  | topic | 创建 | `TopicController.createTopic`；`POST /user/topic/createTopic` | 后端已有；是否只写入指定存储集群仍需联调，当前页面使用 Mock。 |
|  | topic | 删除 | `TopicController.deleteTopic`；`GET /user/topic/deleteTopic` | 后端已有；当前页面未开放。接口采用 GET + RequestBody。 |
|  | consumer group | 查询 | `GroupController.queryGroupListByClusterId`；`POST /user/group/queryGroupListByClusterId` | 后端已有。 |
|  | relationship | 查询关联 EventMesh | `ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId`；`POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | 后端已有；当前页面使用 Mock 关系。 |

## 4. Topic 页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| Topic 页面 | topic | 查询 | `TopicController.queryTopicListByClusterId`；`POST /user/topic/queryTopicListByClusterId` | 后端已有；当前页面的监控指标为 Mock。 |
|  | topic | 创建 | `TopicController.createTopic`；`POST /user/topic/createTopic` | 后端已有；当前页面创建业务 Topic 和物理 Topic 的联动仍为 Mock。 |
|  | topic | 删除 | `TopicController.deleteTopic`；`GET /user/topic/deleteTopic` | 后端已有；当前页面未开放。接口采用 GET + RequestBody。 |

## 5. 客户端连接页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| 客户端连接概览 | connection | 查询指标 | `OverviewController.overview`；`POST /overview/overview` | 后端接口存在，但指标字段和时间维度尚未验证；当前页面为 Mock。 |
| 连接列表 | client | 查询 | `ClientDataController.queryClientByUserForm`；`POST /client/queryClientByUserForm` | 后端已有；表示业务客户端。 |
|  | net connection | 查询 | `NetConnectionController.queryNetConnectionEntityListByFrom`；`POST /netConnection` | 后端已有；与 `ClientEntity` 的页面模型仍需统一。 |

## 6. Consumer 页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| Consumer 页面 | consumer group | 查询 | `GroupController.queryGroupListByClusterId`；`POST /user/group/queryGroupListByClusterId` | 后端已有。 |
|  | consumer group | 删除 | `GroupController.deleteGroupById`；`POST /user/group/deleteGroupById` | 后端已有；当前页面未开放。 |

## 7. Operation 页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| Operation 页面 | operation log | 查询 | `LogController.getLogLIstToFront`；`POST /cluster/log/getList` | 后端已有；当前页面还会合并前端 Mock 复制任务。 |

## 8. Message 页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| Message 页面 | message report | 查询首页报表 | `ReportController.reportByHome`；`/report/reportByHome` | 后端接口存在；请求方法和返回指标仍需联调。 |
|  | message report | 查询单集群报表 | `ReportController.reportBySingle`；`/report/reportBySingle` | 后端接口存在；请求方法和返回指标仍需联调。 |

## 9. Security 页面

| 页面 | metadata | 操作 | controller | 说明 |
| --- | --- | --- | --- | --- |
| Security 页面 | acl | 查询 | `AclController.selectAcl`；`POST /acl/selectAcl` | 后端会调用 Service，但 Controller 返回 `void`；当前页面未接入。 |
|  | acl | 创建 | `AclController.insertAcl`；`POST /acl/insertAcl` | 后端已有；当前页面未开放。 |
|  | acl | 修改 | `AclController.updateAcl`；`POST /acl/updateAcl` | 后端已有；当前页面未开放。 |
|  | acl | 删除 | `AclController.deleteAcl`；`POST /acl/deleteAcl` | 后端已有；当前页面未开放。 |
