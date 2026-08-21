# EventMesh 页面、Metadata 操作与 Controller 对照

本文按照前端页面整理 Metadata 操作，并对应后端 `eventmesh-dashboard-console` 中实际存在的 Controller。

- 后端统一上下文为 `/eventmesh/dashboard`，表中的接口路径省略该前缀。
- `已有`：后端源码存在对应接口和调用逻辑。
- `页面未接入`：后端接口存在，但当前前端页面没有调用。
- `页面 Mock`：当前页面只写入前端本地状态。

## 1. 集群页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="2">大集群页</td><td>all</td><td>查询</td><td><code>ClusterController.queryClusterByOrganizationIdAndType</code><br><code>POST /user/cluster/queryClusterByOrganizationIdAndType</code></td><td>后端已有；当前页面展示前端 Mock 集群。</td></tr>
    <tr><td>all</td><td>复制</td><td><code>ClusterCycleController.createClusterByCopy</code><br><code>POST /organization/clusterCycleDeploy/createClusterByCopy</code></td><td>后端已有；当前页面使用本地复制任务，没有接入后端。</td></tr>
    <tr><td rowspan="11">集群页面</td><td>cluster</td><td>查询基础信息</td><td><code>ClusterController.queryHomeClusterData</code><br><code>GET /user/cluster/queryHomeClusterData</code></td><td>后端已有；接口使用 GET + RequestBody，接入前需要联调。</td></tr>
    <tr><td>cluster</td><td>查询详情</td><td><code>ClusterController.queryClusterDetails</code><br><code>POST /user/cluster/queryClusterDetails</code></td><td><strong>不完整</strong>；当前返回空的 <code>ClusterDetailsVO</code>。</td></tr>
    <tr><td>cluster</td><td>查询拓扑</td><td><code>ClusterController.queryTreeByClusterId</code><br><code>POST /user/cluster/queryTreeByClusterId</code></td><td>后端已有。</td></tr>
    <tr><td>cluster</td><td>基于 Metadata 创建</td><td><code>ClusterCycleController.createClusterByFullMetadata</code><br><code>POST /organization/clusterCycleDeploy/createClusterByFullMetadata</code></td><td>后端已有；当前页面未开放。</td></tr>
    <tr><td>cluster</td><td>基于基础数据创建</td><td><code>ActiveCreateController.createCluster</code><br><code>POST /organization/activeCreate/createCluster</code></td><td>后端已有；当前页面未开放。</td></tr>
    <tr><td>cluster</td><td>基于部署脚本创建</td><td><code>ClusterCycleController.createClusterByDeployScript</code><br><code>POST /organization/clusterCycleDeploy/createClusterByDeployScript</code></td><td>后端已有；当前页面未开放。</td></tr>
    <tr><td>cluster</td><td>直接复制</td><td><code>ClusterCycleController.createClusterByCopy</code><br><code>POST /organization/clusterCycleDeploy/createClusterByCopy</code></td><td>后端已有；当前页面执行的是 Mock 复制。</td></tr>
    <tr><td>relationship</td><td>查询关联</td><td><code>ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId</code><br><code>POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId</code></td><td>后端已有；当前页面关系来自本地 Mock。</td></tr>
    <tr><td>relationship</td><td>建立关联</td><td><code>ClusterRelationshipController.addClusterRelationshipEntry</code><br><code>POST /clusterRelationship/addClusterRelationshipEntry</code></td><td>后端接口存在但已标记 <code>@Deprecated</code>；当前页面调用 <code>addRelations</code>。</td></tr>
    <tr><td>relationship</td><td>解除关联</td><td><code>ClusterRelationshipController.relieveRelationship</code><br><code>POST /clusterRelationship/relieveRelationship</code></td><td>后端接口存在但已标记 <code>@Deprecated</code>；当前页面调用 <code>removeRelation</code>。</td></tr>
    <tr><td>runtime</td><td>创建</td><td><code>ActiveCreateController.createRuntime</code><br><code>POST /organization/activeCreate/createRuntime</code></td><td>后端已有；当前“添加节点”只写入前端状态。</td></tr>
    <tr><td rowspan="5">Runtime 页面</td><td>runtime</td><td>查询</td><td><code>RuntimeController.queryRuntimeListByClusterId</code><br><code>POST /runtime/queryRuntimeListByClusterId</code></td><td>后端已有。</td></tr>
    <tr><td>runtime</td><td>创建</td><td><code>ActiveCreateController.createRuntime</code><br><code>POST /organization/activeCreate/createRuntime</code></td><td>后端已有；当前 Runtime 页面为 Mock 新增。</td></tr>
    <tr><td>runtime</td><td>基于部署脚本创建</td><td><code>ClusterCycleController.createRuntimeByDeployScript</code><br><code>POST /organization/clusterCycleDeploy/createRuntimeByDeployScript</code></td><td>后端已有；当前页面未开放。</td></tr>
    <tr><td>runtime</td><td>查询健康历史</td><td><code>HealthController.getHistoryLiveStatusById</code><br><code>GET /cluster/health/getHistoryLiveStatus</code></td><td>后端已有；当前页面指标为 Mock。</td></tr>
    <tr><td>runtime</td><td>查询可用率</td><td><code>HealthController.getInstanceLiveProportion</code><br><code>GET /cluster/health/getInstanceLiveProportion</code></td><td>后端已有；当前页面指标为 Mock。</td></tr>
  </tbody>
</table>

## 2. Meta 页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="5">Meta 页面</td><td>cluster</td><td>查询集群</td><td><code>ClusterController.queryClusterByOrganizationIdAndType</code><br><code>POST /user/cluster/queryClusterByOrganizationIdAndType</code></td><td>后端已有；按 Meta 集群类型筛选。</td></tr>
    <tr><td>meta</td><td>查询详情</td><td><code>DetailsController.metaDetails</code><br><code>POST /organization/details/meta</code></td><td><strong>不完整</strong>；Controller 方法没有返回详情数据。</td></tr>
    <tr><td>relationship</td><td>查询关联 EventMesh</td><td><code>ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId</code><br><code>POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId</code></td><td>后端已有；当前页面使用 Mock 关系。</td></tr>
    <tr><td>relationship</td><td>建立关联</td><td><code>ClusterRelationshipController.addClusterRelationshipEntry</code><br><code>POST /clusterRelationship/addClusterRelationshipEntry</code></td><td>接口已标记 <code>@Deprecated</code>；当前页面使用 Mock。</td></tr>
    <tr><td>relationship</td><td>解除关联</td><td><code>ClusterRelationshipController.relieveRelationship</code><br><code>POST /clusterRelationship/relieveRelationship</code></td><td>接口已标记 <code>@Deprecated</code>；当前页面使用 Mock。</td></tr>
  </tbody>
</table>

## 3. Kafka 与 RocketMQ 存储页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="7">存储集群页面</td><td>cluster</td><td>查询集群</td><td><code>ClusterController.queryClusterByOrganizationIdAndType</code><br><code>POST /user/cluster/queryClusterByOrganizationIdAndType</code></td><td>后端已有；按 Kafka 或 RocketMQ 类型筛选。</td></tr>
    <tr><td>storage</td><td>查询详情</td><td><code>DetailsController.storageDetails</code><br><code>POST /organization/details/storage</code></td><td><strong>不完整</strong>；Controller 方法没有返回详情数据。</td></tr>
    <tr><td>topic</td><td>查询</td><td><code>TopicController.queryTopicListByClusterId</code><br><code>POST /user/topic/queryTopicListByClusterId</code></td><td>后端已有。</td></tr>
    <tr><td>topic</td><td>创建</td><td><code>TopicController.createTopic</code><br><code>POST /user/topic/createTopic</code></td><td>后端已有；是否只写入指定存储集群仍需联调，当前页面使用 Mock。</td></tr>
    <tr><td>topic</td><td>删除</td><td><code>TopicController.deleteTopic</code><br><code>GET /user/topic/deleteTopic</code></td><td>后端已有；当前页面未开放。接口采用 GET + RequestBody。</td></tr>
    <tr><td>consumer group</td><td>查询</td><td><code>GroupController.queryGroupListByClusterId</code><br><code>POST /user/group/queryGroupListByClusterId</code></td><td>后端已有。</td></tr>
    <tr><td>relationship</td><td>查询关联 EventMesh</td><td><code>ClusterRelationshipController.queryClusterAndRelationshipEntityListByClusterId</code><br><code>POST /clusterRelationship/queryClusterAndRelationshipEntityListByClusterId</code></td><td>后端已有；当前页面使用 Mock 关系。</td></tr>
  </tbody>
</table>

## 4. Topic 页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="3">Topic 页面</td><td>topic</td><td>查询</td><td><code>TopicController.queryTopicListByClusterId</code><br><code>POST /user/topic/queryTopicListByClusterId</code></td><td>后端已有；当前页面的监控指标为 Mock。</td></tr>
    <tr><td>topic</td><td>创建</td><td><code>TopicController.createTopic</code><br><code>POST /user/topic/createTopic</code></td><td>后端已有；当前页面创建业务 Topic 和物理 Topic 的联动仍为 Mock。</td></tr>
    <tr><td>topic</td><td>删除</td><td><code>TopicController.deleteTopic</code><br><code>GET /user/topic/deleteTopic</code></td><td>后端已有；当前页面未开放。接口采用 GET + RequestBody。</td></tr>
  </tbody>
</table>

## 5. 客户端连接页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>客户端连接概览</td><td>connection</td><td>查询指标</td><td><code>OverviewController.overview</code><br><code>POST /overview/overview</code></td><td>后端接口存在，但指标字段和时间维度尚未验证；当前页面为 Mock。</td></tr>
    <tr><td rowspan="2">连接列表</td><td>client</td><td>查询</td><td><code>ClientDataController.queryClientByUserForm</code><br><code>POST /client/queryClientByUserForm</code></td><td>后端已有；表示业务客户端。</td></tr>
    <tr><td>net connection</td><td>查询</td><td><code>NetConnectionController.queryNetConnectionEntityListByFrom</code><br><code>POST /netConnection</code></td><td>后端已有；与 <code>ClientEntity</code> 的页面模型仍需统一。</td></tr>
  </tbody>
</table>

## 6. Consumer 页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="2">Consumer 页面</td><td>consumer group</td><td>查询</td><td><code>GroupController.queryGroupListByClusterId</code><br><code>POST /user/group/queryGroupListByClusterId</code></td><td>后端已有。</td></tr>
    <tr><td>consumer group</td><td>删除</td><td><code>GroupController.deleteGroupById</code><br><code>POST /user/group/deleteGroupById</code></td><td>后端已有；当前页面未开放。</td></tr>
  </tbody>
</table>

## 7. Operation 页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td>Operation 页面</td><td>operation log</td><td>查询</td><td><code>LogController.getLogLIstToFront</code><br><code>POST /cluster/log/getList</code></td><td>后端已有；当前页面还会合并前端 Mock 复制任务。</td></tr>
  </tbody>
</table>

## 8. Message 页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="2">Message 页面</td><td>message report</td><td>查询首页报表</td><td><code>ReportController.reportByHome</code><br><code>/report/reportByHome</code></td><td>后端接口存在；请求方法和返回指标仍需联调。</td></tr>
    <tr><td>message report</td><td>查询单集群报表</td><td><code>ReportController.reportBySingle</code><br><code>/report/reportBySingle</code></td><td>后端接口存在；请求方法和返回指标仍需联调。</td></tr>
  </tbody>
</table>

## 9. Security 页面

<table>
  <thead><tr><th>页面</th><th>metadata</th><th>操作</th><th>controller</th><th>说明</th></tr></thead>
  <tbody>
    <tr><td rowspan="4">Security 页面</td><td>acl</td><td>查询</td><td><code>AclController.selectAcl</code><br><code>POST /acl/selectAcl</code></td><td>后端会调用 Service，但 Controller 返回 <code>void</code>；当前页面未接入。</td></tr>
    <tr><td>acl</td><td>创建</td><td><code>AclController.insertAcl</code><br><code>POST /acl/insertAcl</code></td><td>后端已有；当前页面未开放。</td></tr>
    <tr><td>acl</td><td>修改</td><td><code>AclController.updateAcl</code><br><code>POST /acl/updateAcl</code></td><td>后端已有；当前页面未开放。</td></tr>
    <tr><td>acl</td><td>删除</td><td><code>AclController.deleteAcl</code><br><code>POST /acl/deleteAcl</code></td><td>后端已有；当前页面未开放。</td></tr>
  </tbody>
</table>
