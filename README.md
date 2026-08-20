# EventMesh Dashboard 生产 MVP

面向 EventMesh 的企业级控制台前端，信息层级和资源下钻逻辑参考阿里云 RocketMQ 控制台。当前版本已接入 Spring Boot 与 MySQL 的真实数据，并提供登录、组织隔离和四角色权限控制。

## 已交付范围

- `/login`、`/overview`、`/clusters`、`/clusters/:id/{overview|topology|health|configuration}`
- `/topics`、`/groups`、`/connections`、`/operations`
- `/monitoring`
- `/organization/members`
- EventMesh、RocketMQ、Kafka 与逻辑集群查询；基础集群记录创建、管理方式选择、真实搜索、类型/状态筛选、分页、刷新、空状态和错误状态
- 集群详情资源概览、健康历史、只读配置与拓扑页签；拓扑支持 `cluster_relationship` 驱动的全局—组件—实例三级下钻、动态方向箭头、整卡进入、节点资源详情、搜索和可分享 URL
- Topic 查询和创建；消费组查询和删除；客户端连接与操作审计查询
- 中文/英文切换，优先使用用户保存的语言，其次跟随浏览器语言
- 系统管理员、组织拥有人、组织管理员、组织成员四种角色
- JWT 访问令牌、刷新令牌轮换、注销、401 重登和 403 页面

生产页面不会回退到 mock。后端没有提供的数据会显示为“暂无数据”或“不可用”，不会生成吞吐量、CPU、内存等模拟指标。

## 本地启动

安装依赖并启动 Vite 开发服务器：

```bash
npm install
npm run dev
```

访问：`http://127.0.0.1:5173`

开发服务器会将 `/eventmesh/dashboard` 代理到 `http://127.0.0.1:9898`。可通过 `VITE_EVENTMESH_API_PROXY_TARGET` 指定其他后端地址。

## 构建与预览

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

生产构建输出到 `dist/client`。项目同时保留 Sites 所需的 `dist/server/index.js` 和 `dist/.openai/hosting.json`。

## 后端验证

后端项目位于相邻目录 `../eventmesh-dashboard`，需要 Java 17：

```bash
JAVA_HOME=/path/to/java17 ./mvnw -pl eventmesh-dashboard-console -am package
```

接口映射见 [docs/api-contracts.md](docs/api-contracts.md)，V2 需求覆盖和暂缓项见 [docs/v2-capability-matrix.md](docs/v2-capability-matrix.md)，视觉验收记录见 [design-qa.md](design-qa.md)。
