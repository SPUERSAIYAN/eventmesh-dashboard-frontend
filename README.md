# EventMesh Dashboard 生产 MVP

面向 EventMesh 的企业级控制台前端，信息层级和资源下钻逻辑参考阿里云 RocketMQ 控制台。当前版本已接入 Spring Boot 与 MySQL 的真实数据，并提供登录、组织隔离和四角色权限控制。

## 已交付范围

- `/login`、`/overview`、`/clusters`、`/clusters/:id`
- `/topics`、`/groups`、`/connections`、`/operations`
- `/organization/members`
- 基础集群创建、真实搜索、集群筛选、分页、刷新、空状态和错误状态
- 中文/英文切换，优先使用用户保存的语言，其次跟随浏览器语言
- 系统管理员、组织拥有人、组织管理员、组织成员四种角色
- JWT 访问令牌、刷新令牌轮换、注销、401 重登和 403 页面

生产页面不会回退到 mock。后端没有提供的数据会显示为“暂无数据”或“不可用”，不会生成吞吐量、CPU、内存等模拟指标。

## Docker 启动

复制 `.env.example` 为 `.env`，至少设置强数据库密码、32 字节以上的 JWT 密钥和首次启动管理员密码，然后运行：

```bash
docker compose up --build -d
```

访问：`http://127.0.0.1:4173`

默认 Compose 包含 MySQL 8、Java 17 后端和 Nginx 前端，同源代理 `/eventmesh/dashboard`。MySQL 使用命名卷持久化；后端通过 Flyway 初始化鉴权表。首次空库启动后，管理员账号来自 `.env` 中的 `AUTH_BOOTSTRAP_*` 配置。

如需只在开发环境写入示例业务数据：

```bash
docker compose -f docker-compose.yml -f docker-compose.dev-data.yml up --build -d
```

生产启动不要叠加 `docker-compose.dev-data.yml`。

## 本地验证

前端：

```bash
npm test
npm run build
```

后端：

```bash
JAVA_HOME=/path/to/java17 ./mvnw -pl eventmesh-dashboard-console -am package
```

本机已经构建后端 JAR 时，可使用 `docker-compose.local-build.yml` 加速容器验收：

```bash
docker compose -f docker-compose.yml -f docker-compose.local-build.yml up --build -d
```

接口映射见 [docs/api-contracts.md](docs/api-contracts.md)，视觉验收记录见 [design-qa.md](design-qa.md)。
