# EventMesh 前端页面、增删改查与 Controller 对照

> 路由列统一记录模块入口。同一模块内的概览、列表、节点、关联等页面由“页面”列区分，不再为每个页签重复增加 `section`、`panel` 或末级页面路径。

## 1. 全部集群与 EventMesh 集群

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 全部集群 | `/clusters` | `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**；当前页面实际展示 Mock 集群。 |
| 全部集群 | `/clusters` | 集群复制任务 | **新增** | `POST /organization/clusterCycleDeploy/createClusterByCopy` | `ClusterCycleController` | 前端实际写入 `eventmesh-mock-copy-state-v2`；后端接口源码存在，但缺少任务进度和结果查询接口。 |
| 集群组成概览 | `/clusters/:clusterId` | `ClusterDetailsVO` | 查询 | `POST /user/cluster/queryClusterDetails` | `ClusterController` | **不完整**；当前返回空对象。 |
| 集群组成概览 | `/clusters/:clusterId` | `ClusterTreeVO` | 查询 | `POST /user/cluster/queryTreeByClusterId` | `ClusterController` | **已有**；读取集群、关系和 Runtime 组成。 |
| EventMesh 概要 | `/clusters/:clusterId` | 集群基础信息 | 查询 | `GET /user/cluster/queryHomeClusterData` | `ClusterController` | **候选**；GET 携带 RequestBody，建议调整契约。 |
| EventMesh 概要 | `/clusters/:clusterId` | 概览指标 | 查询 | `POST /overview/overview` | `OverviewController` | **候选**；需确认 `overviewType` 和返回结构。 |
| EventMesh 概要 | `/clusters/:clusterId` | `RuntimeEntity` | **新增** | `POST /organization/activeCreate/createRuntime` | `ActiveCreateController` | 前端实际只追加 React 内存状态；后端 `CreateRuntimeDTO` 包含 `clusterId/name/host/port`，接口可作为候选，但当前没有调用。 |
| EventMesh 概要 | `/clusters/:clusterId` | Meta 节点 | **新增** | — | — | 前端实际只追加 React 内存状态；后端未查询到 Meta 节点创建接口。 |
| EventMesh 概要 | `/clusters/:clusterId` | EventMesh 集群副本 | **新增** | `POST /organization/clusterCycleDeploy/createClusterByCopy` | `ClusterCycleController` | 前端实际写入 `eventmesh-mock-copy-state-v2`，进度由定时器模拟；后端接口当前未调用。 |
| 集群拓扑 | `/clusters/:clusterId` | `ClusterTreeVO` | 查询 | `POST /user/cluster/queryTreeByClusterId` | `ClusterController` | **已有**。 |
| 集群拓扑 | `/clusters/:clusterId` | `RuntimeEntity` | 查询 | `POST /runtime/queryRuntimeListByClusterId` | `RuntimeController` | **已有**。 |
| 集群拓扑 | `/clusters/:clusterId` | `TopicEntity` | 查询 | `POST /user/topic/queryTopicListByClusterId` | `TopicController` | **已有**；Topic 是资源目录，不是拓扑边。 |
| 集群拓扑 | `/clusters/:clusterId` | `GroupEntity` | 查询 | `POST /user/group/queryGroupListByClusterId` | `GroupController` | **已有**；Consumer Group 是资源目录。 |
| EventMesh 关联集群 | `/clusters/:clusterId` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |
| EventMesh 关联集群 | `/clusters/:clusterId` | `ClusterRelationshipEntity` | **新增** | `POST /clusterRelationship/addClusterRelationshipEntry` | `ClusterRelationshipController` | 前端实际调用 `addRelations` 写入本地关系；后端接口存在但已标记 `@Deprecated`。 |
| EventMesh 关联集群 | `/clusters/:clusterId` | `ClusterRelationshipEntity` | **删除** | `POST /clusterRelationship/relieveRelationship` | `ClusterRelationshipController` | 前端“解除”操作实际调用 `removeRelation`；后端接口存在但已标记 `@Deprecated`。 |

## 2. Runtime 集群

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Runtime 概要 | `/clusters/:clusterId/runtime` | Runtime 集群关系 | 查询 | `POST /user/cluster/queryRelationClusterByClusterIdAndType` | `ClusterController` | **不完整**；存在已知 MyBatis 枚举比较错误。 |
| Runtime 概要 | `/clusters/:clusterId/runtime` | `RuntimeEntity` | 查询 | `POST /runtime/queryRuntimeListByClusterId` | `RuntimeController` | **已有**；指标和趋势仍为 Mock。 |
| Runtime 集群列表 | `/clusters/:clusterId/runtime` | Runtime 类型 `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**。 |
| Runtime 列表 | `/clusters/:clusterId/runtime` | `RuntimeEntity` | 查询 | `POST /runtime/queryRuntimeListByClusterId` | `RuntimeController` | **已有**。 |
| Runtime 列表 | `/clusters/:clusterId/runtime` | `RuntimeEntity` | **新增** | `POST /organization/activeCreate/createRuntime` | `ActiveCreateController` | **候选**；当前页面操作为 Mock。 |
| Runtime 被关联列表 | `/clusters/:clusterId/runtime` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |
| Runtime 被关联列表 | `/clusters/:clusterId/runtime` | `ClusterRelationshipEntity` | **新增** | `POST /clusterRelationship/addClusterRelationshipEntry` | `ClusterRelationshipController` | **不完整**；接口已废弃。 |
| Runtime 被关联列表 | `/clusters/:clusterId/runtime` | `ClusterRelationshipEntity` | **删除** | `POST /clusterRelationship/relieveRelationship` | `ClusterRelationshipController` | **不完整**；接口已废弃。 |
| Runtime 控制台概要 | `/clusters/:clusterId/runtime/:runtimeClusterId` | Runtime 实例 | 查询 | `POST /runtime/queryRuntimeListByClusterId` | `RuntimeController` | **已有**；不能覆盖全部页面指标。 |
| Runtime 控制台概要 | `/clusters/:clusterId/runtime/:runtimeClusterId` | 健康历史 | 查询 | `GET /cluster/health/getHistoryLiveStatus` | `HealthController` | **候选**。 |
| Runtime 控制台概要 | `/clusters/:clusterId/runtime/:runtimeClusterId` | 可用率 | 查询 | `GET /cluster/health/getInstanceLiveProportion` | `HealthController` | **候选**。 |
| Runtime 实例 | `/clusters/:clusterId/runtime/:runtimeClusterId` | `RuntimeEntity` | 查询 | `POST /runtime/queryRuntimeListByClusterId` | `RuntimeController` | **已有**。 |
| Runtime 实例 | `/clusters/:clusterId/runtime/:runtimeClusterId` | `RuntimeEntity` | **新增** | `POST /organization/activeCreate/createRuntime` | `ActiveCreateController` | **候选**；当前写入 `localStorage`。 |
| Runtime 客户端连接 | `/clusters/:clusterId/runtime/:runtimeClusterId` | `ClientEntity` | 查询 | `POST /client/queryClientByUserForm` | `ClientDataController` | **候选**；表示业务客户端。 |
| Runtime 客户端连接 | `/clusters/:clusterId/runtime/:runtimeClusterId` | `NetConnectionEntity` | 查询 | `POST /netConnection` | `NetConnectionController` | **候选**；需与 Client 模型统一。 |
| Runtime Topic 与订阅 | `/clusters/:clusterId/runtime/:runtimeClusterId` | `TopicEntity` | 查询 | `POST /user/topic/queryTopicListByClusterId` | `TopicController` | **已有**。 |
| Runtime Topic 与订阅 | `/clusters/:clusterId/runtime/:runtimeClusterId` | `GroupEntity` | 查询 | `POST /user/group/queryGroupListByTopicId` | `GroupController` | **已有**。 |
| Runtime 关联 EventMesh | `/clusters/:clusterId/runtime/:runtimeClusterId` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |

## 3. Meta 集群

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Meta 概要 | `/clusters/:clusterId/meta` | Meta 类型 `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**；只能查询集群基础信息。 |
| Meta 集群列表 | `/clusters/:clusterId/meta` | Meta 类型 `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**。 |
| Meta 被关联列表 | `/clusters/:clusterId/meta` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |
| Meta 被关联列表 | `/clusters/:clusterId/meta` | `ClusterRelationshipEntity` | **新增** | `POST /clusterRelationship/addClusterRelationshipEntry` | `ClusterRelationshipController` | **不完整**；接口已废弃。 |
| Meta 被关联列表 | `/clusters/:clusterId/meta` | `ClusterRelationshipEntity` | **删除** | `POST /clusterRelationship/relieveRelationship` | `ClusterRelationshipController` | **不完整**；接口已废弃。 |
| Meta 控制台概要 | `/clusters/:clusterId/meta/:metaClusterId` | Meta 详情 | 查询 | `POST /organization/details/meta` | `DetailsController` | **不完整**；方法返回 `void`。 |
| Meta 控制台概要 | `/clusters/:clusterId/meta/:metaClusterId` | 监控指标 | 查询 | `POST /overview/overview` | `OverviewController` | **候选**；需补充明确 DTO。 |
| Meta 节点 | `/clusters/:clusterId/meta/:metaClusterId` | Meta 节点 | 查询 | — | — | **缺失**。 |
| Meta 节点 | `/clusters/:clusterId/meta/:metaClusterId` | Meta 节点 | **新增** | — | — | **缺失**；当前只写入 Mock。 |
| Meta 注册信息 | `/clusters/:clusterId/meta/:metaClusterId` | Runtime 注册和租约 | 查询 | — | — | **缺失**。 |
| Meta 关联 EventMesh | `/clusters/:clusterId/meta/:metaClusterId` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |

## 4. Kafka 与 RocketMQ 存储集群

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 存储概要 | `/clusters/:clusterId/storage` | Kafka/RocketMQ `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**；Broker 和监控数据为 Mock。 |
| Kafka 集群列表 | `/clusters/:clusterId/storage` | Kafka `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**。 |
| RocketMQ 集群列表 | `/clusters/:clusterId/storage` | RocketMQ `ClusterEntity` | 查询 | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterController` | **已有**。 |
| 存储被关联列表 | `/clusters/:clusterId/storage` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |
| 存储被关联列表 | `/clusters/:clusterId/storage` | `ClusterRelationshipEntity` | **新增** | `POST /clusterRelationship/addClusterRelationshipEntry` | `ClusterRelationshipController` | **不完整**；接口已废弃。 |
| 存储被关联列表 | `/clusters/:clusterId/storage` | `ClusterRelationshipEntity` | **删除** | `POST /clusterRelationship/relieveRelationship` | `ClusterRelationshipController` | **不完整**；接口已废弃。 |
| 存储控制台概要 | `/clusters/:clusterId/storage/:engine/:storageClusterId` | 存储详情 | 查询 | `POST /organization/details/storage` | `DetailsController` | **不完整**；方法返回 `void`。 |
| 存储控制台概要 | `/clusters/:clusterId/storage/:engine/:storageClusterId` | 监控指标 | 查询 | `POST /overview/overview` | `OverviewController` | **候选**；缺少稳定聚合 DTO。 |
| Broker | `/clusters/:clusterId/storage/:engine/:storageClusterId` | Broker | 查询 | — | — | **缺失**。 |
| Broker | `/clusters/:clusterId/storage/:engine/:storageClusterId` | Broker | **新增** | — | — | **缺失**；当前只写入 Mock。 |
| 物理 Topic | `/clusters/:clusterId/storage/:engine/:storageClusterId` | `TopicEntity` | 查询 | `POST /user/topic/queryTopicListByClusterId` | `TopicController` | **已有**。 |
| 物理 Topic | `/clusters/:clusterId/storage/:engine/:storageClusterId` | `TopicEntity` | **新增** | `POST /user/topic/createTopic` | `TopicController` | **候选**；需验证能否只写指定存储集群。 |
| 物理 Topic | `/clusters/:clusterId/storage/:engine/:storageClusterId` | `TopicEntity` | **删除（页面未开放）** | `GET /user/topic/deleteTopic` | `TopicController` | 后端源码存在；当前物理 Topic 页面没有删除按钮，且接口采用 GET + RequestBody。 |
| 存储消费组 | `/clusters/:clusterId/storage/:engine/:storageClusterId` | `GroupEntity` | 查询 | `POST /user/group/queryGroupListByClusterId` | `GroupController` | **已有**；速率和 lag 需要其他运行数据。 |
| 存储关联 EventMesh | `/clusters/:clusterId/storage/:engine/:storageClusterId` | `ClusterRelationshipEntity` | 查询 | `POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId` | `ClusterRelationshipController` | **候选**。 |

## 5. 主题

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Topic 概览 | `/clusters/:clusterId/topics` | 业务 `TopicEntity` | 查询 | `POST /user/topic/queryTopicListByClusterId` | `TopicController` | **已有**；监控指标为 Mock。 |
| Topic 概览 | `/clusters/:clusterId/topics` | 业务 Topic | **新增** | `POST /user/topic/createTopic` | `TopicController` | **候选**；需支持指定存储目标。 |
| Topic 列表 | `/clusters/:clusterId/topics` | `TopicEntity` | 查询 | `POST /user/topic/queryTopicListByClusterId` | `TopicController` | **已有**。 |
| Topic 列表 | `/clusters/:clusterId/topics` | `TopicEntity` | **新增** | `POST /user/topic/createTopic` | `TopicController` | **候选**；当前页面操作为 Mock。 |
| Topic 列表 | `/clusters/:clusterId/topics` | `TopicEntity` | **删除（页面未开放）** | `GET /user/topic/deleteTopic` | `TopicController` | 后端源码存在；当前 Topic 列表没有删除按钮，且接口采用 GET + RequestBody。 |

## 6. 客户端连接概览

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 客户端连接概览 | `/clusters/:clusterId/connections` | 连接指标 | 查询 | `POST /overview/overview` | `OverviewController` | **候选**；指标契约未验证。 |

## 7. 连接列表

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 连接列表 | `/clusters/:clusterId/connections` | `ClientEntity` | 查询 | `POST /client/queryClientByUserForm` | `ClientDataController` | **候选**。 |
| 连接列表 | `/clusters/:clusterId/connections` | `NetConnectionEntity` | 查询 | `POST /netConnection` | `NetConnectionController` | **候选**；需统一数据模型。 |

## 8. Consumer

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Consumer | `/clusters/:clusterId/consumers` | `GroupEntity` | 查询 | `POST /user/group/queryGroupListByClusterId` | `GroupController` | **已有**。 |
| Consumer | `/clusters/:clusterId/consumers` | `GroupEntity` | **新增** | — | — | **缺失**；当前只写入 Mock。 |
| Consumer | `/clusters/:clusterId/consumers` | `GroupEntity` | **删除（页面未开放）** | `POST /user/group/deleteGroupById` | `GroupController` | 后端源码存在；当前 Consumer 页面没有删除按钮。 |

## 9. 操作记录

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Operations | `/clusters/:clusterId/operations` | `LogEntity` | 查询 | `POST /cluster/log/getList` | `LogController` | **已有**；复制进度没有任务查询接口。 |

## 10. Message

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Message | `/clusters/:clusterId/messages` | 消息速率和趋势 | 查询 | `/report/reportByHome`、`/report/reportBySingle` | `ReportController` | **候选**；需明确请求方法和指标契约。 |

## 11. Security

| 页面 | 路由 | 数据对象 | 操作 | 相关接口 | Controller | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| Security | `/clusters/:clusterId/security` | TLS、Topic ACL、网络白名单模拟记录 | 查询 | — | — | 当前页面实际展示静态 Mock 记录，没有调用后端。 |
| Security | `/clusters/:clusterId/security` | `AclEntity` | **查询（页面未接入）** | `POST /acl/selectAcl` | `AclController` | 后端映射存在，但方法返回 `void`，没有实际 Service 调用。 |
| Security | `/clusters/:clusterId/security` | `AclEntity` | **新增（页面未开放）** | `POST /acl/insertAcl` | `AclController` | 后端映射存在，但方法没有实际写入逻辑。 |
| Security | `/clusters/:clusterId/security` | `AclEntity` | **修改（页面未开放）** | `POST /acl/updateAcl` | `AclController` | 后端映射存在，但方法没有实际更新逻辑。 |
| Security | `/clusters/:clusterId/security` | `AclEntity` | **删除（页面未开放）** | `POST /acl/deleteAcl` | `AclController` | 后端映射存在，但方法没有实际删除逻辑。 |
