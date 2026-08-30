# EventMesh Dashboard Console 数据库表字典

> 整理日期：2026-08-29  
> 适用模块：`eventmesh-dashboard-console`  
> MySQL DDL：`eventmesh-dashboard-console/src/main/resources/eventmesh-dashboard.sql`  
> IoTDB DDL：`eventmesh-dashboard-console/src/main/resources/report/report-RocketMQ.sql`

本文整理 Console 模块 SQL 中的表、字段、业务作用和主要关联。字段含义以 DDL 注释为基础，并结合 Entity、Mapper 和 Service 的实际用法补充。文末单独记录 DDL、Entity 与 Mapper 之间已发现的不一致，避免将现有脚本误当成完全可执行的最终数据模型。

## 1. 数据域总览

| 数据域 | 表 | 主要作用 |
| --- | --- | --- |
| 集群与部署 | `cluster`、`runtime`、`cluster_relationship`、`deploy_script`、`resources_config`、`port` | 保存集群、节点、依赖关系、部署模板、资源规格和端口分配 |
| 配置 | `config` | 保存集群及各类实例的配置项、默认值和差异状态 |
| 消息资源 | `topic`、`group`、`group_member`、`offset` | 保存 Topic、生产/消费组、订阅关系和消费位点 |
| 客户端与链路 | `client`、`connector`、`net_connection` | 保存客户端、Connector 和实际网络连接 |
| 权限与账号 | `instance_user`、`acl` | 保存实例账号凭据和资源访问控制规则 |
| 运维与健康 | `operation_log`、`health_check_result` | 保存操作审计和健康检查历史 |
| 模板与案例 | `case` | 保存面向某类对象的案例/模板引用 |
| 指标报表 | 19 张 `rocketmq_*` IoTDB 表 | 保存 RocketMQ 消息、吞吐、积压、延迟和执行耗时指标 |

### 1.1 核心逻辑关系

```text
organization
└── cluster
    ├── runtime
    ├── config
    ├── topic
    ├── group
    │   └── group_member ── topic
    ├── client
    ├── connector
    ├── net_connection ── client + runtime
    ├── acl
    ├── operation_log
    ├── health_check_result
    └── cluster_relationship ── related cluster

cluster/resources_config/deploy_script ── deployment
topic/group/runtime ── offset
```

DDL 大多只建立索引，没有声明数据库级外键；上述关系主要由 `*_id` 字段和业务代码维护。

### 1.2 通用字段约定

| 字段 | 通用含义 |
| --- | --- |
| `id` | 表内自增主键 |
| `organization_id` | 数据所属组织，用于多租户隔离 |
| `cluster_id` | 所属物理或逻辑集群 ID，通常对应 `cluster.id` |
| `runtime_id` | 所属节点 ID，通常对应 `runtime.id` |
| `status` | 有效/运行状态；多数表约定 `1` 有效、`0` 无效，但个别表有自己的状态枚举 |
| `is_delete` | 逻辑删除标记，通常 `0` 未删除、`1` 已删除 |
| `create_time` | 记录创建时间 |
| `update_time` | 最后更新时间，通常由 MySQL 自动刷新 |

## 2. MySQL 表字典

### 2.1 `case`——案例/对象模板索引

保存一个组织内的“案例”及其关联对象，可用于部署案例、配置案例或其他对象模板的统一索引。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 案例主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `name` | `varchar(128)` | NOT NULL | 案例名称 |
| `case_type` | `varchar(16)` | NOT NULL | 案例分类 |
| `object_type` | `varchar(16)` | NOT NULL | 被引用对象类型 |
| `object_id` | `varchar(32)` | NOT NULL | 被引用对象 ID；使用字符串以容纳不同对象标识 |
| `status` | `int` | DEFAULT `1` | 案例有效状态 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建/接入时间 |
| `update_time` | `timestamp` | 自动更新 | 最后修改时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

索引：`(object_type, object_id)`，用于按对象反查案例。

### 2.2 `deploy_script`——部署脚本模板

保存不同集群类型和版本范围使用的部署脚本内容。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 脚本主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `name` | `varchar(128)` | NOT NULL | 脚本名称 |
| `version` | `varchar(128)` | NOT NULL | 脚本自身版本 |
| `cluster_type` | `varchar(128)` | NOT NULL | 适用集群类型 |
| `content` | `varchar(8192)` | NOT NULL | 部署脚本正文 |
| `start_runtime_version` | `varchar(16)` | NOT NULL | 支持的最低 Runtime 版本 |
| `end_runtime_version` | `varchar(16)` | NOT NULL | 支持的最高 Runtime 版本 |
| `description` | `varchar(1024)` | NOT NULL | 脚本说明 |
| `status` | `int` | DEFAULT `1` | 脚本有效状态 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后修改时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

索引：`organization_id`。`cluster.deploy_script_id` 和 `runtime.deploy_script_id` 逻辑引用该表。

### 2.3 `resources_config`——资源规格

保存某类对象的 CPU、内存、磁盘和 GPU 资源规格，供部署集群或 Runtime 时引用。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 资源规格主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `name` | `varchar(128)` | NOT NULL | 规格名称；DDL 注释误写为“案例名” |
| `object_type` | `varchar(16)` | NOT NULL | 规格适用的对象类型 |
| `object_id` | `varchar(32)` | NOT NULL | 规格绑定的对象 ID |
| `cpu_num` | `int` | NOT NULL | CPU 数量/配额 |
| `men_num` | `int` | NOT NULL | 内存数量；字段名疑似应为 `mem_num` |
| `disk_num` | `int` | NOT NULL | 磁盘容量/配额 |
| `gpu_num` | `int` | NOT NULL | GPU 数量/配额 |
| `status` | `int` | DEFAULT `1` | 规格有效状态 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后修改时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

索引：`(object_type, object_id)`。`cluster.resources_config_id` 和 `runtime.resources_config_id` 逻辑引用该表。

### 2.4 `cluster`——物理/逻辑集群主表

Console 的核心资产表，保存 EventMesh、Kafka、RocketMQ 等集群的基础信息、部署信息、托管状态和扩展配置。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 集群主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_type` | `varchar(64)` | NOT NULL | 集群类型，如 `EVENTMESH_JVM_CLUSTER`、`STORAGE_KAFKA_CLUSTER` |
| `name` | `varchar(128)` | NOT NULL, UNIQUE | 集群名称；当前为全表唯一，不是组织内唯一 |
| `version` | `varchar(32)` | NOT NULL | 集群软件版本 |
| `cluster_index` | `int` | DEFAULT `0` | 集群内部索引/序号 |
| `jmx_properties` | `varchar(256)` | DEFAULT `''` | JMX 配置或连接参数 |
| `trusteeship_type` | `varchar(32)` | NOT NULL | 托管方式，如托管、自维护 |
| `cluster_own_type` | `varchar(32)` | NOT NULL | 集群归属/共享方式 |
| `runtime_index` | `int` | DEFAULT `0` | 下一个 Runtime 编号或端口段分配索引 |
| `first_to_whom` | `varchar(16)` | NOT NULL | 初次同步的主导方 |
| `first_sync_state` | `varchar(16)` | DEFAULT `NOT` | 初次同步结果 |
| `replication_type` | `varchar(16)` | NOT NULL | 主从、复制或部署架构类型 |
| `sync_error_type` | `varchar(16)` | DEFAULT `NOT` | 元数据同步异常类型 |
| `deploy_status_type` | `varchar(16)` | NOT NULL | 部署生命周期状态，如创建成功、暂停成功 |
| `resources_config_id` | `varchar(16)` | NOT NULL | 默认资源规格 ID；逻辑关联 `resources_config.id` |
| `deploy_script_id` | `bigint unsigned` | NOT NULL | 默认部署脚本 ID |
| `deploy_script_name` | `varchar(16)` | DEFAULT `''` | 部署脚本名称快照 |
| `deploy_script_version` | `varchar(16)` | DEFAULT `''` | 部署脚本版本快照 |
| `config` | `varchar(8192)` | NOT NULL | 集群扩展配置 JSON；当前包含地域、云厂商、Kubernetes 集群等 |
| `description` | `text` | NULL | 集群描述/备注 |
| `auth_type` | `varchar(32)` | DEFAULT `0` | 认证类型 |
| `run_state` | `tinyint` | DEFAULT `1` | 监控状态：`0` 未监控，`1` 有注册中心监控，`2` 无注册中心监控 |
| `online_timestamp` | `datetime` | CURRENT_TIMESTAMP | 上线时间 |
| `offline_timestamp` | `datetime` | CURRENT_TIMESTAMP | 下线时间 |
| `status` | `int` | DEFAULT `1` | 记录有效状态 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 接入/创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(name)`。该表被 Runtime、Topic、Group、配置、连接、ACL、日志和健康检查等多数业务表引用。

### 2.5 `cluster_relationship`——集群关系边

使用有方向的“主集群 → 关联集群”记录表达 EventMesh、Meta、Runtime、Kafka、RocketMQ 等集群之间的依赖或复用关系。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 关系主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_type` | `varchar(63)` | NOT NULL | 主集群类型 |
| `cluster_id` | `bigint` | NOT NULL | 主集群 ID |
| `relationship_type` | `varchar(63)` | NOT NULL | 关联集群类型 |
| `relationship_id` | `bigint` | NOT NULL | 关联集群 ID |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 建立关系时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `status` | `int` | DEFAULT `1` | 关系状态；代码中还使用 `3` 表示解除 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束与索引：`UNIQUE(cluster_id, relationship_id)`，并分别索引 `cluster_id`、`relationship_id`。唯一键未包含关系类型和组织 ID。

### 2.6 `config`——实例配置项

保存集群、Runtime、Storage、Connector、Topic 等实例的配置键值、版本范围、默认值和同步状态。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 配置主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_id` | `bigint` | NOT NULL | 所属集群；`-1` 在部分代码中表示模板/默认配置 |
| `cluster_type` | `varchar(32)` | NOT NULL | 集群类型 |
| `instance_type` | `varchar(31)` | NOT NULL | 配置对象类型，如 Runtime、Storage、Connector、Topic、Cluster |
| `instance_id` | `bigint` | DEFAULT `-1` | 配置对象 ID；DDL 注释约定 `-1` 表示集群级配置 |
| `config_type` | `varchar(31)` | DEFAULT `''` | 配置分类 |
| `config_name` | `varchar(192)` | NOT NULL | 配置键名 |
| `config_value` | `text` | NOT NULL | 配置值 |
| `config_value_type` | `varchar(16)` | NOT NULL | 值类型，如 number、string、boolean、date、enum |
| `config_value_range` | `varchar(16)` | NOT NULL | 合法值范围或枚举范围 |
| `start_version` | `varchar(64)` | DEFAULT `''` | 配置开始适用版本 |
| `end_version` | `varchar(64)` | DEFAULT `''` | 配置结束适用版本 |
| `sync_status` | `varchar(16)` | DEFAULT `ING` | 配置同步状态 |
| `status` | `int` | DEFAULT `1` | `0` 关闭，`1` 开启 |
| `is_default` | `int` | DEFAULT `1` | 是否为默认配置 |
| `diff_type` | `int` | DEFAULT `-1` | 与元数据或默认值的差异类型 |
| `description` | `varchar(1000)` | DEFAULT `''` | 配置说明 |
| `edit` | `int` | DEFAULT `1` | 可编辑性：DDL 约定 `1` 程序获取/不可编辑，`2` 可编辑 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `is_modify` | `int` | DEFAULT `0` | 是否修改过元版本数据 |
| `already_update` | `int` | DEFAULT `0` | 是否已完成更新：`0` 否，`1` 是 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(instance_id, config_name, instance_type, cluster_id)`。

### 2.7 `topic`——Topic 元数据

保存各集群中的 Topic、队列/分区数、副本数、保留时间和创建进度。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | Topic 主键 |
| `cluster_id` | `bigint` | DEFAULT `-1` | 所属集群 |
| `cluster_type` | `varchar(32)` | NOT NULL | 所属集群类型 |
| `runtime_id` | `bigint unsigned` | DEFAULT `0` | 所属 Runtime；Kafka 等集群可能没有 Runtime 维度 |
| `topic_name` | `varchar(192)` | DEFAULT `''` | Topic 名称 |
| `topic_type` | `varchar(16)` | DEFAULT `''` | Topic 来源/用途，如用户、Broker、Console |
| `read_queue_num` | `int` | DEFAULT `8` | 读队列数量 |
| `write_queue_num` | `int` | DEFAULT `8` | 写队列数量 |
| `replication_factor` | `int` | DEFAULT `0` | 副本数量 |
| `order` | `int` | DEFAULT `0` | 是否为顺序/定时类队列；当前注释含义需再统一 |
| `sync_status` | `varchar(16)` | DEFAULT `ING` | 元数据同步状态 |
| `status` | `int` | DEFAULT `1` | Topic 有效状态 |
| `create_progress` | `int` | DEFAULT `1` | 创建进度：`0` 成功，`1` 创建中，`2` 失败 |
| `retention_ms` | `bigint` | DEFAULT `-2` | 保存时间：`-2` 未知，`-1` 无限，非负值单位毫秒 |
| `description` | `varchar(1024)` | DEFAULT `''` | Topic 说明 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间，尽量与真实 MQ 一致 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(cluster_id, runtime_id, topic_name)`。

### 2.8 `group`——生产者/消费者组

保存集群中的 Producer Group 和 Consumer Group。由于 `group` 是 SQL 关键字，SQL 中应始终使用反引号。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | Group 主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_id` | `bigint` | NOT NULL | 所属集群 |
| `cluster_type` | `varchar(32)` | NOT NULL | 所属集群类型 |
| `name` | `varchar(192)` | NOT NULL | Group 名称 |
| `type` | `tinyint` | NOT NULL | Group 类型：`0` Consumer，`1` Producer |
| `own_type` | `varchar(16)` | DEFAULT `''` | Group 来源/归属类型 |
| `sync_status` | `varchar(16)` | DEFAULT `ING` | 元数据同步状态 |
| `state` | `varchar(64)` | DEFAULT `''` | Group 运行状态 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `status` | `int` | DEFAULT `1` | Group 有效状态 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(cluster_id, name)`。

### 2.9 `group_member`——Topic 与 Group 订阅关系

保存某个集群中 Topic、Group 和 EventMesh 用户之间的订阅/成员关系。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 成员关系主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_id` | `bigint` | DEFAULT `-1` | 所属集群 |
| `topic_name` | `varchar(192)` | DEFAULT `''` | Topic 名称 |
| `group_name` | `varchar(192)` | DEFAULT `''` | Group 名称 |
| `eventmesh_user` | `varchar(192)` | DEFAULT `''` | EventMesh 用户/订阅主体 |
| `sync_status` | `varchar(16)` | DEFAULT `ING` | 元数据同步状态 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `status` | `int` | DEFAULT `1` | 关系有效状态 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(cluster_id, topic_name, group_name)`。当前关系使用名称而不是 `topic_id/group_id`。

### 2.10 `offset`——Topic/消费位点

保存 Topic 队列位点、Group 消费位点、消费速率和积压量。`offset` 可能与 SQL 语义冲突，建议使用反引号。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 位点记录主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_id` | `bigint unsigned` | DEFAULT `-1` | 所属集群 |
| `runtime_id` | `bigint unsigned` | DEFAULT `-1` | 所属 Runtime |
| `offset_record_type` | `varchar(16)` | DEFAULT `''` | 记录类型：Topic 位点或消费位点 |
| `topic_id` | `bigint unsigned` | DDL 默认值异常 | Topic ID |
| `topic_name` | `varchar(128)` | DDL 默认值异常 | Topic 名称 |
| `queue_index` | `bigint` | DDL 默认值异常 | 队列/分区索引 |
| `topic_offset` | `bigint unsigned` | DDL 默认值异常 | Topic 当前最大位点 |
| `group_id` | `bigint unsigned` | DDL 默认值异常 | Group ID |
| `group_name` | `varchar(128)` | DDL 默认值异常 | Group 名称 |
| `consume_offset` | `bigint unsigned` | DDL 默认值异常 | 当前消费位点 |
| `consume_rote` | `bigint unsigned` | DDL 默认值非法 | 消费速率；字段名疑似应为 `consume_rate` |
| `delay_num` | `bigint unsigned` | DDL 默认值非法 | 消费积压/延迟数量 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `status` | `int` | DEFAULT `1` | 记录有效状态 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

索引：`(cluster_id, topic_name, group_name)`。本表 DDL 存在多个不可执行的默认值，详见第 5 节。

### 2.11 `runtime`——集群运行节点

保存 Runtime、Broker、NameServer 等集群节点的地址、版本、部署状态和 Kubernetes 信息。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint` | PK, AUTO_INCREMENT | Runtime 主键 |
| `organization_id` | `bigint unsigned` | NOT NULL | 所属组织 |
| `cluster_id` | `bigint` | DEFAULT `-1` | 所属集群 |
| `cluster_type` | `varchar(63)` | NOT NULL | Runtime/节点类型 |
| `name` | `varchar(128)` | NOT NULL | 节点名称 |
| `host` | `int` | NOT NULL | 对外 IP；DDL 类型与 Entity 的字符串类型不一致 |
| `port` | `int` | NOT NULL | 服务端口 |
| `runtime_index` | `int` | DEFAULT `-1` | 节点在集群内的序号 |
| `version` | `varchar(32)` | NOT NULL | Runtime 版本 |
| `jmx_port` | `varchar(256)` | DEFAULT `''` | JMX 端口/配置；DDL 与 Entity 类型不一致 |
| `trusteeship_type` | `varchar(16)` | NOT NULL | 托管类型 |
| `first_to_whom` | `varchar(16)` | NOT NULL | 初次同步主导方 |
| `first_sync_state` | `varchar(16)` | DEFAULT `NOT` | 初次同步结果 |
| `replication_type` | `varchar(16)` | NOT NULL | 节点复制角色/类型 |
| `sync_error_type` | `varchar(16)` | DEFAULT `NOT` | 同步异常类型 |
| `deploy_status_type` | `varchar(16)` | NOT NULL | 部署生命周期状态 |
| `kubernetes_cluster_id` | `bigint` | UNIQUE, DEFAULT `0` | Kubernetes 集群/资源标识 |
| `create_script_content` | `text` | NOT NULL | Kubernetes 等场景的创建脚本内容 |
| `resources_config_id` | `varchar(16)` | NOT NULL | 默认资源规格 ID |
| `deploy_script_id` | `bigint unsigned` | NOT NULL | 默认部署脚本 ID |
| `deploy_script_name` | `varchar(16)` | DEFAULT `''` | 脚本名称快照 |
| `deploy_script_version` | `varchar(16)` | DEFAULT `''` | 脚本版本快照 |
| `auth_type` | `varchar(16)` | DEFAULT `''` | 认证类型；DDL 注释“认真类型”为笔误 |
| `description` | `text` | NULL | 节点说明 |
| `rack` | `varchar(128)` | DEFAULT `''` | 机架/可用区信息 |
| `status` | `int` | DEFAULT `1` | `1` 启用，`0` 停用 |
| `online_timestamp` | `datetime` | CURRENT_TIMESTAMP | 上线时间 |
| `offline_timestamp` | `datetime` | CURRENT_TIMESTAMP | 下线时间 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `endpoint_map` | `varchar(1024)` | DEFAULT `''` | 多协议监听端点映射 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(cluster_id, host)`；该约束未包含端口，虽然索引名包含 `host_port`。

### 2.12 `client`——业务客户端

保存连接 EventMesh 的业务客户端进程、平台、语言和协议信息。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint` | PK, AUTO_INCREMENT | 客户端主键 |
| `cluster_id` | `bigint` | DEFAULT `-1` | 所属集群 |
| `name` | `varchar(192)` | DEFAULT `''` | 客户端名称 |
| `platform` | `varchar(192)` | DEFAULT `''` | 操作系统/运行平台 |
| `language` | `varchar(192)` | DEFAULT `''` | 客户端语言/SDK 类型 |
| `pid` | `bigint` | DEFAULT `-1` | 客户端进程 ID |
| `host` | `varchar(128)` | DEFAULT `''` | 客户端地址 |
| `port` | `int` | DEFAULT `-1` | 客户端端口 |
| `protocol` | `varchar(192)` | DEFAULT `''` | 接入协议 |
| `status` | `tinyint unsigned` | DEFAULT `1` | `1` 启用/在线，`0` 停用/结束 |
| `config_ids` | `varchar(1024)` | DEFAULT `''` | 关联配置 ID 的 CSV 列表 |
| `description` | `varchar(1024)` | DEFAULT `''` | 客户端说明 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 接入时间 |
| `end_time` | `timestamp` | CURRENT_TIMESTAMP | 连接/客户端结束时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |

索引：`cluster_id`。

### 2.13 `net_connection`——客户端到 Runtime 的网络连接

保存客户端与 Runtime 之间的一条实际 TCP/协议连接及其起止时间。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 网络连接主键 |
| `cluster_id` | `bigint unsigned` | DEFAULT `0` | 所属集群 |
| `client_id` | `bigint unsigned` | NOT NULL | 客户端 ID，逻辑关联 `client.id` |
| `client_host` | `varchar(192)` | NOT NULL | 客户端地址快照 |
| `client_port` | `int` | NOT NULL | 客户端端口快照 |
| `runtime_id` | `bigint unsigned` | DEFAULT `0` | Runtime ID |
| `runtime_host` | `varchar(192)` | NOT NULL | Runtime 地址快照 |
| `runtime_port` | `int` | NOT NULL | Runtime 端口快照 |
| `status` | `tinyint unsigned` | DEFAULT `1` | `1` 连接中，`2` 已断开 |
| `description` | `varchar(1024)` | DEFAULT `''` | 连接说明 |
| `connection_time` | `timestamp` | NOT NULL | 建连时间 |
| `disconnect_time` | `timestamp` | NOT NULL | 断连时间 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 记录创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |

索引：`cluster_id`、`client_id`、`runtime_id`。

### 2.14 `instance_user`——实例账号与凭据

保存物理集群或软件实例的用户名、密码和 Token。该表包含敏感信息，应限制读取、日志输出和前端返回。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 账号主键 |
| `instance_type` | `int` | DEFAULT `0` | 实例/软件类型 |
| `password` | `varchar(100)` | DEFAULT `''` | 密码或认证秘密；不应明文存储 |
| `cluster_id` | `bigint unsigned` | NOT NULL | 所属物理集群 |
| `name` | `varchar(192)` | DEFAULT `''` | 用户名/账号名 |
| `token` | `varchar(8192)` | DEFAULT `''` | Token、密钥或扩展凭据 |
| `status` | `int` | DEFAULT `1` | `1` 启用，`0` 停用 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

约束：`UNIQUE(cluster_id, name)`。

### 2.15 `acl`——访问控制规则

保存集群级的 ACL 规则，描述某个主体从某个 Host 对 Topic、Group 等资源执行操作的权限。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | ACL 主键 |
| `cluster_id` | `bigint` | DEFAULT `0` | 所属集群 |
| `pattern` | `varchar(192)` | DEFAULT `''` | 主体/User/Service 匹配模式 |
| `operation` | `int` | DEFAULT `0` | 允许或限制的操作类型 |
| `permission_type` | `int` | DEFAULT `0` | `0` 未知，`1` 任意，`2` 拒绝，`3` 允许 |
| `host` | `varchar(192)` | DEFAULT `''` | 规则适用的来源 Host |
| `resource_type` | `int` | DEFAULT `0` | `0` 未知，`1` 任意，`10` Kafka Topic，`11` Kafka Group，`21` RocketMQ Topic |
| `resource_name` | `varchar(192)` | DEFAULT `''` | 资源名称 |
| `pattern_type` | `tinyint` | NOT NULL | `0` 未知，`1` 任意，`2` match，`3` literal，`4` prefixed |
| `status` | `int` | DEFAULT `1` | `0` 删除，`1` 存在 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 更新时间 |

索引：`(cluster_id, pattern, resource_name)`。

### 2.16 `operation_log`——操作审计日志

保存针对集群、Topic、Group 等对象的操作过程、执行人、结果和状态。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 日志主键 |
| `cluster_id` | `bigint` | DEFAULT `-1` | 操作所属集群 |
| `operation_type` | `varchar(192)` | DEFAULT `''` | 操作类型，如启动、停止、重启、添加、删除、修改 |
| `state` | `int` | DEFAULT `0` | `0` 未知，`1` 执行中，`2` 成功，`3` 失败 |
| `content` | `varchar(1024)` | NOT NULL | 操作内容/备注 |
| `operation_user` | `varchar(192)` | NOT NULL | 操作用户 |
| `result` | `varchar(1024)` | NOT NULL | 方法返回或执行结果 |
| `target_type` | `varchar(192)` | NOT NULL | 目标对象类型，如 Group、Topic、Cluster |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 操作开始/创建时间 |
| `end_time` | `timestamp` | 自动更新 | 操作结束时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

索引：`cluster_id`。

### 2.17 `connector`——Connector 实例

保存 Source/Sink Connector 的类、类型、运行地址、Pod 状态和配置引用。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | Connector 主键 |
| `cluster_id` | `bigint` | DEFAULT `-1` | 所属集群 |
| `name` | `varchar(512)` | DEFAULT `''` | Connector 名称 |
| `class_name` | `varchar(512)` | DEFAULT `''` | Connector 实现类 |
| `type` | `varchar(32)` | DEFAULT `''` | Source/Sink 或业务类型 |
| `host` | `varchar(128)` | DEFAULT `''` | Connector 地址 |
| `port` | `int` | DEFAULT `-1` | Connector 端口 |
| `status` | `tinyint unsigned` | DEFAULT `1` | `1` 启用，`0` 停用 |
| `pod_state` | `tinyint unsigned` | DEFAULT `0` | Kubernetes Pod：`0` Pending，`1` Running，`2` Success，`3` Failed，`4` Unknown |
| `config_ids` | `varchar(1024)` | DEFAULT `''` | 关联配置 ID 的 CSV 列表 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |

索引：`cluster_id`。当前 DDL 在左括号后多了字符 `x`，直接执行会失败。

### 2.18 `health_check_result`——健康检查历史

保存对 Cluster、Runtime、Topic 等对象执行心跳或协议检查的结果。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 检查记录主键 |
| `cluster_type` | `varchar(64)` | NOT NULL | 集群类型 |
| `cluster_id` | `bigint` | DEFAULT `0` | 所属集群 |
| `protocol` | `varchar(64)` | NOT NULL | 检查使用的协议 |
| `type` | `tinyint` | DEFAULT `0` | 检查维度：`0` 未知，`1` Cluster，`2` Runtime，`3` Topic |
| `type_id` | `bigint unsigned` | NOT NULL | 被检查对象 ID |
| `address` | `varchar(64)` | NOT NULL | 被检查地址 |
| `health_check_type` | `varchar(64)` | NOT NULL | 心跳/健康检查类型 |
| `result` | `varchar(64)` | NOT NULL | 检查结果 |
| `result_desc` | `varchar(1024)` | DEFAULT `''` | 结果说明或错误原因 |
| `begin_time` | `timestamp` | NOT NULL | 检查开始时间 |
| `finish_time` | `timestamp` | 自动更新 | 检查完成时间 |

约束：`UNIQUE(type_id, type, begin_time)`；索引：`cluster_id`。Mapper 中多处使用 `create_time/update_time/state`，与本 DDL 不一致。

### 2.19 `port`——集群端口分配游标

用于在创建 Runtime 时串行分配端口段，并通过 `FOR UPDATE` 防止并发冲突。

| 字段 | 类型 | 约束/默认值 | 作用 |
| --- | --- | --- | --- |
| `id` | `bigint unsigned` | PK, AUTO_INCREMENT | 端口记录主键 |
| `cluster_id` | `bigint` | NOT NULL, UNIQUE | 所属集群；每个集群一条端口游标 |
| `runtime_id` | `bigint` | NOT NULL | 最近关联的 Runtime ID |
| `current_port` | `int` | DEFAULT `0` | 当前已分配到的端口值/下一段起点 |
| `status` | `int` | DEFAULT `1` | `1` 启用，`0` 停用 |
| `create_time` | `timestamp` | CURRENT_TIMESTAMP | 创建时间 |
| `update_time` | `timestamp` | 自动更新 | 最后更新时间 |
| `is_delete` | `int` | DEFAULT `0` | 逻辑删除标记 |

## 3. Mapper/Entity 引用但主 DDL 缺失的表

以下表在 Java 代码中被直接查询或写入，但 `eventmesh-dashboard.sql` 没有对应 `CREATE TABLE`，不能视为已完成的数据模型。

### 3.1 `connection`——业务消息链路

`ConnectionMapper` 用它表达 Source 到 Sink 的逻辑连接，与 `net_connection` 的物理网络连接不同。

| 推断字段 | 作用 |
| --- | --- |
| `id` | 连接主键 |
| `cluster_id` | 所属集群 |
| `source_type` / `source_id` | 来源类型和 ID，类型通常为 Connector 或 Client |
| `sink_type` / `sink_id` | 目标类型和 ID |
| `runtime_id` | 经由的 Runtime |
| `topic` | 使用的 Topic |
| `group_id` | 使用的 Group |
| `status` | 连接状态 |
| `description` | 连接说明 |
| `create_time` / `end_time` | 建立和结束时间 |

待办：补充正式 DDL、唯一键以及连接结束时 `status` 的语义；当前 Mapper 的 `endConnectionById` 将 `status` 更新为 `1`，与常见约定不一致。

### 3.2 `config_template`——配置模板

`ConfigTemplateMapper` 和 `ConfigTemplateEntity` 使用该表，推断字段包括 `id`、`organization_id`、`cluster_type`、`version`、`metadata_type`、`name` 以及通用审计字段。

待办：补充正式 DDL；修正 Mapper INSERT 中重复的 `metadata_type` 列和参数数量不匹配问题。

### 3.3 `collect`——采集任务配置

`CollectManage` 直接查询该表，用来决定集群采用 EventMesh、Prometheus 或其他采集方式。

| 推断字段 | 作用 |
| --- | --- |
| `id`、`organization_id`、`cluster_id`、`cluster_type` | 采集任务身份和所属范围 |
| `collect_type` | 采集方式 |
| `save_time` | 指标保存时长 |
| `collect_interval` | 采集周期 |
| `storage_cluster_id` | 指标存储集群 ID |
| `storage_cluster_name` | 指标存储集群名称；Entity 当前错误声明为 `Long` |
| `enable` | 是否启用采集 |
| `default_storage` | 是否使用默认存储 |
| `status`、`create_time`、`update_time`、`is_delete` | 状态和审计字段 |

### 3.4 只有 Entity、没有持久化表定义

| Entity | 预期用途 | 当前情况 |
| --- | --- | --- |
| `MetadataSyncResultEntity` | 保存元数据同步结果和错误 | 当前主要保存在内存记录中，没有 DDL/Mapper |
| `ConfigGatherEntity` | 配置集合/配置组 | 没有 DDL/Mapper |

## 4. RocketMQ IoTDB 指标表

`report/report-RocketMQ.sql` 创建 `eventmesh_dashboard` IoTDB 数据库，默认 TTL 为 `2592000000 ms`（约 30 天）。指标表采用统一维度结构。

### 4.1 通用字段

| 字段 | IoTDB 类型 | 作用 |
| --- | --- | --- |
| `time` | `timestamp time` | 指标采集时间 |
| `organization_id` | `string tag` | 组织 ID，作为查询标签 |
| `organization_name` | `string attribute` | 组织名称 |
| `clusters_id` | `string tag` | 集群 ID；字段名使用了复数 `clusters_id` |
| `cluster_name` | `string attribute` | 集群名称 |
| `runtime_type` | `string attribute` | Runtime 类型 |
| `runtime_id` | `string tag` | Runtime ID |
| `runtime_name` | `string attribute` | Runtime 名称 |
| `topic_id` | `string tag` | Topic ID，仅 Topic/消息维度表存在 |
| `topic_name` | `string attribute` | Topic 名称，仅 Topic/消息维度表存在 |
| `group_id` | `string tag` | Consumer Group ID，仅消费维度表存在 |
| `group_name` | `string attribute` | Consumer Group 名称，仅消费维度表存在 |
| `message_type` | `string attribute` | 消息类型，仅消息维度表存在 |
| `value` | `int64 field` | 指标值；具体单位由表含义决定 |

### 4.2 指标表清单

| 表 | 作用 | 特有维度/指标字段 |
| --- | --- | --- |
| `rocketmq_messages_in_total` | 流入消息总数 | Topic、`message_type`、`value` |
| `rocketmq_messages_out_total` | 流出消息总数 | Topic、`message_type`、`value` |
| `rocketmq_throughput_in_total` | 流入消息体总量/吞吐 | Topic、`message_type`、`value` |
| `rocketmq_throughput_out_total` | 流出消息体总量/吞吐 | Topic、`message_type`、`value` |
| `rocketmq_consumer_ready_messages` | Consumer 已就绪/待消费消息量 | Topic、Group、`value` |
| `rocketmq_consumer_inflight_messages` | Consumer 处理中消息量 | Topic、Group、`value` |
| `rocketmq_consumer_queueing_latency` | 待消费消息排队延迟 | Topic、Group、`value` |
| `rocketmq_consumer_lag_latency` | 消费处理延迟 | Topic、Group、`value` |
| `rocketmq_send_to_dlq_messages_total` | 进入死信队列的消息总数 | Topic、Group、`value` |
| `rocketmq_storage_message_reserve_time` | 存储层消息保留时间 | Runtime、`value` |
| `rocketmq_storage_dispatch_behind_bytes` | Dispatch 落后字节数 | Runtime、`value` |
| `rocketmq_storage_flush_behind_bytes` | 刷盘落后字节数 | Runtime、`value` |
| `rocketmq_thread_pool_wartermark` | 线程池排队水位 | `name` 表示线程池名称，`value` 表示排队数；表名 `wartermark` 疑似拼写错误 |
| `rocketmq_topic_number` | Topic 数量 | Runtime、`value` |
| `rocketmq_consumer_group_number` | Consumer Group 数量 | Runtime、`value` |
| `rocketmq_message_size` | 消息大小分布 | `value_le_1_kb`、`value_le_4_kb`、`value_le_512_kb`、`value_le_1_mb`、`value_le_2_mb`、`value_le_4_mb`、`value_le_overflow` |
| `rocketmq_rpc_latency` | RPC 调用耗时分布 | `protocol_type`、`request_code`、`response_code`；`value_le_1_ms`、`3_ms`、`5_ms`、`10_ms`、`100_ms`、`1_s`、`3_s`、`overflow_s` |
| `rocketmq_topic_create_execution_time` | 创建 Topic 的执行耗时分布 | `value_le_10_ms`、`100_ms`、`1_s`、`3_s`、`5_s`、`overflow_s` |
| `rocketmq_consumer_group_create_execution_time` | 创建 Consumer Group 的执行耗时分布 | `value_le_10_ms`、`100_ms`、`1_s`、`3_s`、`5_s`、`overflow_s` |

直方图表中的 `value_le_*` 字段表示耗时或大小落在对应上限桶内的计数，`value_le_overflow*` 表示超过最大桶的数量。

## 5. 已发现的结构与 SQL 风险

| 优先级 | 位置 | 问题 | 影响/建议 |
| --- | --- | --- | --- |
| 高 | `connector` DDL | `create table connector` 后多出字符 `x` | 主 DDL 直接执行失败，应删除多余字符 |
| 高 | `offset` DDL | 多个数字字段使用空字符串或中文文本作为默认值 | MySQL 严格模式下建表失败；为数字字段设置合法数字默认值 |
| 高 | `health_check_result` | DDL 使用 `result/begin_time/finish_time`，Mapper 使用 `state/create_time/update_time` | 查询和写入会报未知字段；统一 DDL、Entity 和 Mapper |
| 高 | `port` | DDL 要求 `runtime_id NOT NULL`，Mapper 插入时只写 `cluster_id/current_port` | 插入失败；确定是否真的需要 `runtime_id` |
| 高 | `connection`、`config_template`、`collect` | Java 代码直接使用，但主 DDL 没有建表 | 新环境运行对应功能会失败；补充迁移脚本 |
| 高 | `config_template` Mapper | INSERT 重复声明 `metadata_type`，列数和参数数不一致 | 插入 SQL 无法执行 |
| 中 | `runtime.host` | DDL 为 `int`，Entity 为 `String` | IPv4/IPv6/域名无法可靠保存；建议改为 `varchar` |
| 中 | `runtime.jmx_port` | DDL 为 `varchar(256)`，Entity 为 `Integer` | 映射和写入类型不一致 |
| 中 | `runtime` | Entity 包含 `pod_host`、`admin_port`、`start_timestamp`，DDL 缺失 | 字段不会持久化或查询失败，需要统一模型 |
| 中 | `cluster` | DDL 有 `cluster_index/run_state`，Entity 缺少；Entity 有 `create_method/start_timestamp`，DDL 缺少 | 部分字段无法映射或无法持久化 |
| 中 | `config` | Entity/Mapper 使用 `business_type`、`retrospect_id`、`eventmesh_version`，DDL 未定义 | 部分配置 SQL 会失败 |
| 中 | `group` | Mapper 更新 `member_count` 等字段，DDL 未定义 | Group 状态同步可能失败 |
| 中 | `topic` | Entity 使用 `save_time/topic_filter_type/attributes`，DDL 未定义 | Topic 元数据无法完整保存 |
| 中 | `resources_config` | DDL 为 `men_num int`，Entity 为 `memNum Float` | 字段拼写与类型不一致 |
| 中 | `net_connection` | Mapper 没有注解且资源目录没有对应 XML | 方法可能没有可执行 SQL 映射 |
| 中 | `cluster_relationship` | 唯一键只有 `(cluster_id, relationship_id)` | 不同组织或不同关系类型无法重复使用同一对 ID |
| 低 | `cluster.name` | 全表唯一 | 多组织无法使用相同集群名称；如需租户隔离应改为 `(organization_id, name)` |
| 低 | `instance_user` | `password/token` 设计为直接字符串存储 | 应采用加密/密钥托管、脱敏返回和严格权限控制 |
| 低 | 命名 | `men_num`、`consume_rote`、`wartermark`、`clusters_id` 等拼写不一致 | 增加维护成本，建议通过迁移统一命名 |

## 6. 维护建议

1. 将当前一次性 `drop table/create table` 脚本拆分为版本化迁移脚本，禁止生产环境直接执行全量 Drop。
2. 以数据库迁移文件作为唯一结构基线，Entity 和 Mapper 变更必须同时更新迁移及本字典。
3. 为核心逻辑关系补充外键或至少增加一致性校验、组合索引和删除策略。
4. 统一 `status`、`is_delete`、`sync_status`、`deploy_status_type` 的枚举和生命周期定义。
5. 所有多租户唯一键和查询条件评估是否必须包含 `organization_id`。
6. `instance_user` 等敏感表禁止记录明文凭据，API、日志和错误信息中必须脱敏。
7. 为 DDL 增加 CI 校验：在空 MySQL/IoTDB 实例执行建表，并校验 Mapper 引用字段均存在。
