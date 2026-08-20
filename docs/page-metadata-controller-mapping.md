# EventMesh 前端页面、Metadata 操作与 Controller 对照

本文根据当前 `eventmesh-dashboard-frontend` 页面和后端 `eventmesh-dashboard-console` 源码整理，用于前后端接口对齐、能力盘点与后续开发排期。

## 1. 约定

- 后端模块：`eventmesh-dashboard-console`
- 后端统一上下文：`/eventmesh/dashboard`
- 下表中的 API 路径省略统一上下文，例如 `/user/cluster/queryTreeByClusterId` 的完整地址为 `/eventmesh/dashboard/user/cluster/queryTreeByClusterId`。
- `Metadata` 表示页面管理或展示的核心领域数据。

### 能力状态

| 标记 | 含义 |
| --- | --- |
| 已有 | Controller 有明确映射且已被当前前端数据层使用，或源码具备可读实现 |
| 候选 | Controller/接口存在，但当前前端未接入，接入前仍需联调验证 |
| 不完整 | 接口为空实现、返回固定值、缺少注入、已废弃，或已知运行失败 |
| 缺失 | 当前后端源码没有与页面操作相匹配的 Controller 能力 |
| Mock | 当前页面只修改前端状态，不调用后端 |

## 2. 页面与 Controller 总表

### 2.1 全部集群与 EventMesh 集群

| 页面 / 路由 | Metadata | <div style="min-width: 240px; white-space: nowrap;">页面操作（查询 / 新增 / 修改 / 删除）</div> | Controller / API | 说明 |
| --- | --- | --- | --- | --- |
| 全部集群 `/clusters` | `ClusterEntity`：集群 ID、名称、类型、地域、版本、托管方式、状态 | 查询集群列表、按名称/地域筛选、进入集群 | **已有** `ClusterController`：`POST /user/cluster/queryClusterByOrganizationIdAndType` | 当前原型列表展示的是 mock 集群；历史数据层已具备该查询接口。CPU、内存、MQ 速率等页面字段没有稳定的同源接口，不能由集群列表接口直接提供。 |
| 全部集群 `/clusters` | 源集群快照、目标名称、Topic 集合、Consumer Group 集合、复制任务进度 | 复制整个集群 | **候选** `ClusterCycleController`：`POST /organization/clusterCycleDeploy/createClusterByCopy` | 页面当前为 **Mock**，任务进度及复制结果保存在 `eventmesh-mock-copy-state-v2`。后端接口只接收 `CreateClusterByCopyDTO`，与页面的资源选择、进度和历史闭环尚未对齐。 |
| 集群概览 `/clusters/:clusterId/summary` | 当前 EventMesh、关联的 Runtime/Meta/Kafka/RocketMQ 集群、节点数、关系 | 查看整体组成、进入组件控制台、查看拓扑、管理关联 | **候选** `ClusterController`：`POST /user/cluster/queryClusterDetails`；**已有** `POST /user/cluster/queryTreeByClusterId` | `queryClusterDetails` 当前构造并返回空的 `ClusterDetailsVO`，因此详情聚合能力属于 **不完整**；拓扑树接口可作为只读关系来源。 |
| EventMesh 概要 `/clusters/:clusterId/overview` | `ClusterEntity`、组件关系、Runtime/Meta/Broker 汇总、资源利用率、复制任务 | 查看托管与资源摘要、进入子模块、复制集群、添加节点 | **已有** `ClusterController`：`GET /user/cluster/queryHomeClusterData`；**候选** `OverviewController`：`POST /overview/overview` | 首页基础数据可映射 `queryHomeClusterData`，但 GET + RequestBody 的契约不适合浏览器常规调用，建议后端后续统一为 POST 或查询参数。页面利用率与趋势目前为 **Mock**。 |
| EventMesh 概要 `/clusters/:clusterId/overview` | Runtime/Meta 节点草稿 | 添加节点 | Runtime：**候选** `ActiveCreateController`：`POST /organization/activeCreate/createRuntime`；Meta：**缺失** | 页面当前为 **Mock**，并允许一次选择 Runtime 或 Meta。后端只存在 Runtime 创建入口，没有独立 Meta 节点创建 Controller，也没有统一的“向关联组件集群扩容节点”契约。 |
| 集群拓扑 `/clusters/:clusterId/topology` | `ClusterTreeVO`、集群关系、Runtime 成员、Topic、Consumer Group | 查询拓扑、切换关系图/资源树、搜索和选中节点、刷新 | **已有** `ClusterController`：`POST /user/cluster/queryTreeByClusterId`；`RuntimeController`：`POST /runtime/queryRuntimeListByClusterId`；`TopicController`：`POST /user/topic/queryTopicListByClusterId`；`GroupController`：`POST /user/group/queryGroupListByClusterId` | 这些接口可组合构建拓扑和资源树。当前新管理原型仍将 mock 关系转换成拓扑数据。Topic/Consumer 在资源树中是目录展示，不应被解释为真实集群拓扑边。 |
| EventMesh 被关联列表 `/clusters/:clusterId/relations` | `ClusterRelationshipEntity`、组件 `ClusterEntity` | 查询关系、建立关系、解除关系、查看关系拓扑 | 查询：**候选** `ClusterRelationshipController`：`POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId`；新增/解除：同 Controller 的 `addClusterRelationshipEntry`、`relieveRelationship` | 页面当前为 **Mock**，关系保存在 `eventmesh-mock-component-relations-v1`。新增和解除接口已标记 `@Deprecated`；`ClusterController.queryRelationClusterByClusterIdAndType` 还存在已知 MyBatis enum/string 比较失败，不应直接接入。 |

### 2.2 Runtime 与 Meta 集群

| 页面 / 路由 | Metadata | <div style="min-width: 240px; white-space: nowrap;">页面操作（查询 / 新增 / 修改 / 删除）</div> | Controller / API | 说明 |
| --- | --- | --- | --- | --- |
| Runtime 概要 `/clusters/:clusterId/runtime` | Runtime 集群、实例、状态、消息速率、反向引用 | 查看汇总、进入集群列表或关系页 | **候选** `ClusterController`：`POST /user/cluster/queryRelationClusterByClusterIdAndType`；`RuntimeController`：`POST /runtime/queryRuntimeListByClusterId` | Runtime 实例查询接口可用；关系查询接口有已知运行问题。当前页面的监控指标和组件关系均为 **Mock**。 |
| Runtime 集群列表 `/clusters/:clusterId/runtime?section=clusters` | Runtime 类型 `ClusterEntity`、节点数、版本、地域、关系数 | 查询/筛选、进入 Runtime 控制台、查看拓扑、管理关联 | **已有** `ClusterController`：`POST /user/cluster/queryClusterByOrganizationIdAndType`；关系查询同上 | 可按 `organizationId + clusterType` 查询 Runtime 集群；关系状态需额外接口或由拓扑树派生。 |
| Runtime 列表 `/clusters/:clusterId/runtime?section=runtimes` | `RuntimeEntity`：名称、地址、版本、状态、所属集群 | 查询 Runtime、添加节点 | 查询：**已有** `RuntimeController`：`POST /runtime/queryRuntimeListByClusterId`；创建：**候选** `ActiveCreateController`：`POST /organization/activeCreate/createRuntime` | 当前列表与新增均为 **Mock**。创建接口需要确认 DTO 是否能够表达目标 Runtime 集群、地址、角色和部署方式。 |
| Runtime 被关联列表 `/clusters/:clusterId/runtime?section=relations` | Runtime 集群与 EventMesh 的反向关系 | 查询、建立/解除关系、查看拓扑 | `ClusterRelationshipController`，同 EventMesh 关系页 | 页面显示所有 EventMesh 对 Runtime 的反向引用。后端现有写接口已废弃，需先确定新的关系维护契约。 |
| Runtime 控制台概要 `/clusters/:clusterId/runtime/:runtimeClusterId/overview` | Runtime 集群详情、实例健康、连接、Topic/订阅、吞吐 | 查看监控与基本信息、刷新、查看拓扑 | `RuntimeController`、`OverviewController`、`HealthController`、`ReportController` | 当前全部为 **Mock**。`HealthController` 有历史状态和可用率查询；`OverviewController/ReportController` 返回类型较宽泛，需联调确认指标名和时间维度。 |
| Runtime 实例 `/clusters/:clusterId/runtime/:runtimeClusterId/instances` | `RuntimeEntity` | 查询实例、添加 Runtime | 查询：`RuntimeController`；创建：`ActiveCreateController.createRuntime` | 页面新增资源写入 `eventmesh-mock-writable-resources-v1`，尚未接后端。 |
| Runtime 客户端连接 `/clusters/:clusterId/runtime/:runtimeClusterId/connections` | `ClientEntity`/`NetConnectionEntity`：客户端、协议、Runtime、连接数、活动时间、状态 | 查询和筛选连接 | **候选** `ClientDataController`：`POST /client/queryClientByUserForm`；`NetConnectionController`：`POST /netConnection` | 两个接口返回的数据粒度不同，需要先确定页面采用“业务客户端”还是“网络连接”模型。当前数据为 **Mock**。 |
| Runtime Topic 与订阅 `/clusters/:clusterId/runtime/:runtimeClusterId/topics` | `TopicEntity`、Topic 与 Consumer Group 关系 | 查询 Topic、订阅方式、订阅方 | `TopicController.queryTopicListByClusterId`；`GroupController.queryGroupListByTopicId` | 可组合查询，但后端没有与页面“广播/集群订阅方式”完全对应的稳定字段说明。 |
| Runtime 关联 EventMesh `/clusters/:clusterId/runtime/:runtimeClusterId/relations` | 组件集群反向关系 | 查询关联 EventMesh、查看拓扑 | `ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId` | 只读页面可优先接入；当前为 **Mock**。 |
| Meta 概要 `/clusters/:clusterId/meta` | Meta 集群、Meta 节点、Leader、Runtime 注册、反向引用 | 查看汇总、进入集群列表或关系页 | **候选** `ClusterController` + `OverviewController` | 后端没有 Meta 专属 Controller；只能先按集群类型查询 `ClusterEntity`，Meta 节点、Leader 和注册信息尚无明确稳定契约。 |
| Meta 集群列表 `/clusters/:clusterId/meta?section=clusters` | Meta 类型 `ClusterEntity` | 查询/筛选、进入 Meta 控制台、查看拓扑、管理关联 | `ClusterController.queryClusterByOrganizationIdAndType` | 可查询 Meta 类型集群；当前页面为 **Mock**。 |
| Meta 被关联列表 `/clusters/:clusterId/meta?section=relations` | Meta 集群与 EventMesh 的反向关系 | 查询、建立/解除关系、查看拓扑 | `ClusterRelationshipController` | 写接口已废弃，当前页面使用本地 mock 关系。 |
| Meta 控制台概要 `/clusters/:clusterId/meta/:metaClusterId/overview` | Meta 节点、Leader、Runtime 注册、注册/发现速率、延迟 | 查看监控、刷新、查看拓扑 | **不完整** `DetailsController`：`POST /organization/details/meta`；候选 `OverviewController`、`HealthController`、`ReportController` | `DetailsController.eventMeshDetails/metaDetails/...` 返回 `void` 且没有有效实现，不能作为详情接口。当前监控值均为 **Mock**。 |
| Meta 节点 `/clusters/:clusterId/meta/:metaClusterId/nodes` | Meta 节点名称、角色、地址、延迟、状态 | 查询节点、添加 Meta 节点 | **缺失** | 当前写入本地 mock；后端没有 Meta 节点 CRUD Controller。 |
| Meta 注册信息 `/clusters/:clusterId/meta/:metaClusterId/registry` | 注册到 Meta 的 Runtime、来源集群、地址、续约周期、状态 | 查询和筛选注册信息 | **缺失** | `RuntimeController` 只能按集群查 Runtime，无法表达 Meta 注册表、租约和续约状态。 |
| Meta 关联 EventMesh `/clusters/:clusterId/meta/:metaClusterId/relations` | Meta 集群反向关系 | 查询关联 EventMesh、查看拓扑 | `ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId` | 当前为 **Mock**。 |

### 2.3 存储集群（Kafka / RocketMQ）

| 页面 / 路由 | Metadata | <div style="min-width: 240px; white-space: nowrap;">页面操作（查询 / 新增 / 修改 / 删除）</div> | Controller / API | 说明 |
| --- | --- | --- | --- | --- |
| 存储概要 `/clusters/:clusterId/storage` | Kafka/RocketMQ 集群、Broker、状态、反向引用 | 查看汇总、进入存储集群或关系页 | `ClusterController.queryClusterByOrganizationIdAndType`；关系查询同上 | 可按集群类型读取 Kafka/RocketMQ 集群；Broker 与监控数据目前为 **Mock**。 |
| Kafka/RocketMQ 列表 `/clusters/:clusterId/storage?section=kafka|rocketmq` | 存储 `ClusterEntity`、Broker 数、版本、地域、关系数 | 查询/筛选、进入存储控制台、查看拓扑、管理关联 | `ClusterController.queryClusterByOrganizationIdAndType` | 页面当前为 **Mock**。 |
| 存储被关联列表 `/clusters/:clusterId/storage?section=relations` | 存储集群与 EventMesh 的反向关系 | 查询、建立/解除关系、查看拓扑 | `ClusterRelationshipController` | 与 Runtime/Meta 关系页共用同一关系模型。 |
| 存储控制台概要 `/clusters/:clusterId/storage/:engine/:storageClusterId/overview` | Broker、物理 Topic、消费组、读写速率、容量、关系 | 查看监控、刷新、查看拓扑 | `OverviewController`、`ReportController`、`HealthController` | 当前均为 **Mock**。现有接口没有一份已验证的 Kafka/RocketMQ 控制台聚合 DTO。 |
| Broker `/clusters/:clusterId/storage/:engine/:storageClusterId/brokers` | Broker 名称、角色、地址、Broker ID、资源、状态 | 查询 Broker、添加 Broker | **缺失** | 后端将部分运行节点抽象为 `RuntimeEntity`，但没有明确的 Broker CRUD Controller；页面当前写入本地 mock。 |
| 物理 Topic `/clusters/:clusterId/storage/:engine/:storageClusterId/topics` | `TopicEntity`：名称、分区/队列、副本、速率、存储量、状态 | 查询 Topic、创建物理 Topic | 查询：`TopicController.queryTopicListByClusterId`；创建：**候选** `POST /user/topic/createTopic` | 页面当前为 **Mock**。后端创建接口会经 `ClusterMetadataDomain` 扩散写入，是否能精确表达“只在选定存储集群创建物理 Topic”需验证，不能直接视为等价能力。 |
| 存储消费组 `/clusters/:clusterId/storage/:engine/:storageClusterId/groups` | `GroupEntity`、订阅 Topic、成员、速率、积压、状态 | 查询消费组 | `GroupController.queryGroupListByClusterId`、`queryGroupListByTopicId` | 基础清单可查；成员数、实时速率和 lag 需要额外运行数据接口。 |
| 存储关联 EventMesh `/clusters/:clusterId/storage/:engine/:storageClusterId/relations` | 存储集群反向关系 | 查询关联 EventMesh、查看拓扑 | `ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId` | 当前为 **Mock**。 |

### 2.4 Topic、连接、Consumer、Operation、Message、Security

| 页面 / 路由 | Metadata | <div style="min-width: 240px; white-space: nowrap;">页面操作（查询 / 新增 / 修改 / 删除）</div> | Controller / API | 说明 |
| --- | --- | --- | --- | --- |
| Topic 概览 `/clusters/:clusterId/topics` | EventMesh 业务 Topic、物理存储目标、分区/队列、副本、吞吐和健康 | 查看监控、添加业务 Topic | 查询：**已有** `TopicController.queryTopicListByClusterId`；创建：**候选** `TopicController.createTopic` | 页面当前为 **Mock**。前端语义是“一次创建业务 Topic，并同步创建选定存储集群的物理 Topic”；现有 DTO/Controller 是否支持指定唯一存储目标需补充契约测试。 |
| Topic 列表 `/clusters/:clusterId/topics?section=list` | `TopicEntity` | 查询、筛选、添加 Topic | 同上；删除候选：`GET /user/topic/deleteTopic` | 删除接口使用 GET + RequestBody，不符合常规 REST 语义，且当前产品要求隐藏 Topic 删除；不建议前端接入。 |
| 客户端连接概览 `/clusters/:clusterId/connections` | 连接数、新建/断开/失败率、协议、Runtime 状态 | 查看监控 | `OverviewController`、`ReportController`、`HealthController` | 当前为 **Mock**；指标查询契约未验证。 |
| 连接列表 `/clusters/:clusterId/connections?section=list` | `ClientEntity`/`NetConnectionEntity` | 查询客户端连接 | `ClientDataController.queryClientByUserForm`、`NetConnectionController` | 当前为 **Mock**。此处表示客户端到 Runtime 的连接，不是 Connector/Pipeline。 |
| Consumer `/clusters/:clusterId/consumers` | `GroupEntity`：名称、Topic、实例数、消费速率、lag、状态 | 查询、添加 Consumer Group | 查询：**已有** `GroupController.queryGroupListByClusterId`；创建：**缺失**；删除候选：`POST /user/group/deleteGroupById` | 当前新增为 **Mock**。后端只有查询和删除，没有 Consumer Group 创建接口。 |
| Operations `/clusters/:clusterId/operations` | `LogEntity`、复制任务状态 | 查询操作历史、查看复制进度 | **已有** `LogController`：`POST /cluster/log/getList` | 当前页面将 mock 复制任务和静态记录合并显示；后端操作日志接口可作为正式历史来源，但复制任务阶段/进度需要独立任务模型。 |
| Message `/clusters/:clusterId/messages` | Topic 数、Consumer 数、流入/消费速率和趋势 | 查看消息运行汇总 | `ReportController`：`/report/reportByHome`、`/report/reportBySingle`；`OverviewController` | 当前为 **Mock**。接入前需确定 reportName、返回列名、时间范围和单位。 |
| Security `/clusters/:clusterId/security` | TLS、Topic ACL、管理网络白名单 | 查看安全策略 | **不完整** `AclController`：`POST /acl/insertAcl`、`deleteAcl`、`updateAcl`、`selectAcl` | 四个方法当前均返回 `void`，且没有调用 Service；页面明确标注为模拟配置，不能视为后端已支持。 |
| 配置（当前路由未开放） | `ConfigEntity` | 按实例查询配置、更新配置 | 查询：**已有** `ConfigController`：`POST /user/config/queryByInstanceId`；更新：**不完整** `POST /user/config/cluster/config/updateConfigs` | 查询已在旧数据层定义；更新方法只返回字符串 `success`，没有执行更新，当前应保持只读。 |

## 3. 前端本地 Metadata 写入位置

| Metadata | 本地存储键 | 当前操作 | 对应后端状态 |
| --- | --- | --- | --- |
| 集群复制任务和复制出的集群 | `eventmesh-mock-copy-state-v2` | 创建任务、推进进度、生成目标集群 | 有复制 Controller 候选，但没有与页面一致的任务查询、进度和结果契约 |
| EventMesh 与组件集群关系 | `eventmesh-mock-component-relations-v1` | 建立、解除、复制时继承关系 | 查询接口候选；写接口已废弃；直接关系查询存在已知运行问题 |
| Runtime/Meta/Broker 节点、业务 Topic、物理 Topic、Consumer Group | `eventmesh-mock-writable-resources-v1` | 新增 | 仅 Runtime 和 Topic 有部分候选接口；Meta/Broker/Consumer Group 创建缺失 |
| 集群详情页临时节点 | React 页面内存 `extraNodes` | 添加 Runtime/Meta 节点 | 刷新即丢失；仅用于当前原型展示 |

## 4. Controller 归属速查

| Controller | 主要职责 | 当前判断 |
| --- | --- | --- |
| `ClusterController` | 集群列表、拓扑树、关联集群查询、部分集群创建 | 列表和拓扑可用；详情与部分创建方法不完整；直接关系查询已知失败 |
| `ClusterRelationshipController` | 集群关系查询、建立、解除 | 查询可作为候选；写操作已废弃 |
| `RuntimeController` | Runtime 列表与详情 | 可用于只读列表/详情 |
| `TopicController` | Topic 列表、详情、创建、删除、Topic 下消费组 | 列表已使用；写操作需验证；删除接口语义不规范 |
| `GroupController` | Consumer/Producer Group 查询与删除 | 查询已使用；没有创建接口 |
| `ClientDataController` / `NetConnectionController` | 客户端与网络连接查询 | 候选，需统一页面数据模型 |
| `LogController` | 集群操作日志 | 可用于 Operation 历史 |
| `ConfigController` | 实例配置查询与更新 | 查询可用；更新为空操作 |
| `HealthController` | 健康历史与可用率 | 候选，需要联调类型枚举和时间参数 |
| `OverviewController` / `ReportController` | 概览和通用报表 | 候选，返回结构和指标定义需补充文档 |
| `ActiveCreateController` | 集群、Runtime、完整 EventMesh 集群创建 | 存在接口，但多个流程未形成已验证闭环 |
| `ClusterCycleController` | 脚本部署、复制、完整 Metadata 创建 | 复制入口存在；任务状态与前端模型未对齐 |
| `ConnectionController` | Connector/Pipeline 配置与创建 | 不应映射到“客户端连接”页面；且 `connectionDataService` 未注入，当前调用有空指针风险 |
| `AclController` | ACL CRUD 名义入口 | 方法没有实际 Service 调用，不能使用 |
| `DetailsController` | EventMesh/Meta/Storage 详情名义入口 | 方法为空，不能使用 |

## 5. 建议的后端补齐顺序

1. 先稳定只读闭环：集群列表、拓扑、Runtime、Topic、Consumer Group、操作日志。
2. 提供统一的组件关系查询 DTO，修复 `queryRelationClusterByClusterIdAndType` 的枚举比较问题；新增非废弃的关系创建/解除接口。
3. 为 Runtime、Meta、Kafka、RocketMQ 分别定义组件详情与节点/Broker 清单契约，避免前端根据 `ClusterEntity` 猜测节点类型。
4. 为业务 Topic 创建定义“EventMesh Topic + 指定存储目标 + 物理 Topic”的原子操作；补充 Consumer Group 创建接口。
5. 为集群复制提供任务 ID、阶段、进度、结果、失败原因和操作日志关联，替代前端定时递增进度。
6. 最后接入监控、连接、配置写入和 ACL；在此之前保持这些页面只读或明确标记为 Mock。

## 6. 代码依据

- 前端路由与导航：`src/App.tsx`、`src/routes.ts`、`src/clusterDefinitions.ts`
- 前端页面和操作：`src/MockClusterExperience.tsx`、`src/ComponentClusterConsole.tsx`、`src/StorageClusterConsole.tsx`、`src/MockResourceCreateModals.tsx`
- 前端本地 Metadata：`src/mockClusterStore.ts`、`src/mockClusterRelations.ts`、`src/mockWritableResources.ts`
- 已接入 API：`src/api/dashboardRepository.ts`、`src/api/resourceRepository.ts`
- 后端 Controller：`eventmesh-dashboard-console/src/main/java/org/apache/eventmesh/dashboard/console/controller`
