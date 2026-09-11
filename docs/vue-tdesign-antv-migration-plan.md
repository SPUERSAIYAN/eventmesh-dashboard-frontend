# EventMesh Dashboard 前端技术栈迁移计划

> 目标分支：`vue-frontend`  
> 目标技术栈：Vue 3 + TypeScript + TDesign Vue Next + AntV G2/G6  
> 文档性质：实施与评审基线；本阶段不修改后端，不改变现有业务/API 契约

## 1. TL;DR

当前生产入口仍是 React 19，页面使用 Ant Design、React Router、TanStack React Query 和 ECharts；仓库已经加入 Vue、TDesign、AntV、Pinia、Vue Query 依赖，并存在尚未接入页面的 `useG2Chart.ts` 与 `trendChartOptions.ts`。推荐按“先固定契约和基线、再搭 Vue 外壳、按路由纵向迁移、最后原子切换入口并清理旧栈”的顺序实施。

目标产物遵守以下硬约束：

- 应用框架只使用 Vue 3，不保留 React 运行时、JSX/TSX 页面或 React 适配层。
- UI 组件和图标只使用 `tdesign-vue-next`、`tdesign-icons-vue-next`，不保留 Ant Design 或其他组件库。
- 趋势图使用 AntV G2，关系拓扑使用 AntV G6；不保留 ECharts、`echarts-for-react` 或其他图表组件。
- Pinia、Vue Query、Axios、Zod、字体包属于状态、请求、校验和资产基础设施，不视为 UI 组件库；它们可以保留。
- 迁移不改变 URL、查询参数、后端接口、Mock 持久化 key、Sites 构建产物和既有产品信息架构。
- 新功能从 Vue 目标目录直接实现，不再向 `.tsx`、Ant Design 或 ECharts 代码追加能力。

不建议在同一个 DOM 树中挂载 React/Vue 微前端桥接。迁移分支可以暂时同时存在两套源码和依赖，但任一构建入口只能运行一个框架；最终合并门禁要求旧栈依赖和源码引用为零。

## 2. 现状证据与迁移边界

### 2.1 已确认事实

- `src/main.tsx` 使用 `createRoot`、React Query Provider 和 React 版 i18n Provider。
- `src/App.tsx` 同时承担全局壳、导航、状态栏、路由和大量历史页面组件，共 657 行；真正的路由入口只指向集群 Mock/混合数据体验、存储集群控制台和 Runtime/Meta 控制台，文件中另有未被当前路由使用的遗留页面。
- 当前有 14 个源码文件直接依赖 React、9 个依赖 Ant Design、10 个依赖 Ant Design Icons、5 个依赖 React Router、6 个依赖 React Query、3 个依赖 `echarts-for-react`。
- 当前 React Hooks 使用量至少包括 88 个 `useState`、25 个 `useEffect`、19 个 `useMemo`、5 个 `useRef`、2 个 `useContext`；不能用机械 JSX 转模板完成迁移。
- 样式共约 6,500 行，发现 94 处 `.ant-*`/`--ant-*` 耦合，分布在 7 个 CSS 文件；样式兼容是独立工作流，不应留到页面迁移末尾处理。
- `src/store/mockClusterStore.ts` 和 `src/store/mockLifecycleStore.ts` 使用 `useSyncExternalStore`，并持久化关系、可写资源和生命周期状态；目标态应迁到 Pinia，但必须保留现有 localStorage key 和数据规范化逻辑。
- 现有 URL helper 位于 `src/routes.ts`，对 topology 查询参数有专门的清洗规则；迁移后必须保持输出完全一致。
- 现有构建可成功生成 Sites 所需文件，但主 JS 为约 2.5 MB（gzip 约 798 KB），Vite 已产生大 chunk 警告。
- 当前单元测试基线为 69 项中 67 项通过；两个失败是测试仍引用 `src/mockClusterRelations.ts` 和 `src/mockWritableResources.ts`，而实现已经位于 `src/mock/` 目录。该问题应在迁移前单独修复，避免把既有失败误判为 Vue 回归。
- 当前工作区已有未提交修改：`package.json`、`package-lock.json`，以及未跟踪的 AntV/Vue 文件；实施时必须保留这些用户改动并在其上继续。

### 2.2 范围内

- Vite、TypeScript、应用入口和构建脚本的 Vue 化。
- 路由、布局、全部当前可达页面、共享组件、弹窗、状态反馈和 i18n 的 Vue 化。
- React Query 到 Vue Query、React 外部 Store 到 Pinia 的迁移。
- Ant Design 到 TDesign 的组件、图标和交互语义适配。
- ECharts 到 AntV G2、现有拓扑实现到 AntV G6 + TDesign Tree 的可视化适配。
- 样式 Token、组件局部样式、响应式行为和可访问性兼容。
- 测试、构建、架构依赖门禁、路由兼容、视觉回归和 Sites 产物验证。

### 2.3 范围外

- 后端 Java、数据库、API、鉴权、权限或部署契约变更。
- 新增后端能力或把 Mock 数据伪装成 Live 数据。
- 重新设计产品信息架构、删除现有可达功能或改变视觉方向。
- 在这次框架迁移中顺便连接其他页面的新后端接口。

## 3. 目标架构

```text
index.html
  -> src/main.ts
      -> createApp(App.vue)
      -> Pinia
      -> VueQueryPlugin
      -> Vue Router
      -> TDesign + TDesign CSS
          -> AppShell.vue
              -> RouterView
                  -> 页面级 View
                      -> 领域组件 / TDesign
                      -> Vue Query -> 既有 repository -> Axios -> 后端
                      -> Pinia -> versioned localStorage Mock 状态
                      -> AntV G2/G6 composables -> Canvas/SVG
```

建议目录：

```text
src/
  main.ts
  App.vue
  router/
    index.ts
    paths.ts
  layouts/
    AppShell.vue
    ClusterShell.vue
  views/
    clusters/
    components/
    storage/
  components/
    common/
    lifecycle/
    resources/
    charts/
  topology/
    components/
    useTopologyGraph.ts
    topologyTree.ts
  composables/
    useI18n.ts
    useG2Chart.ts
    usePersistedState.ts
  stores/
    mockCluster.ts
    mockLifecycle.ts
    copyTasks.ts
  api/                  # 保留现有纯 TS 契约与 repository
  config/ data/ mock/   # 保留纯 TS 领域数据和规范化函数
  styles/
    tokens.css
    reset.css
    shell.css
    pages/
```

职责约束：

- Vue Query 只管理后端 server state、缓存、刷新和 mutation receipt。
- Pinia 只管理前端持久化 Mock 状态和跨页面 UI 状态；不复制 Vue Query 数据。
- 路由参数是视图位置和可分享筛选状态的唯一来源，不在 Store 中保存第二份路由状态。
- API、Zod schema、路径生成、拓扑树转换和 Mock 领域函数继续保持框架无关，禁止导入 Vue/TDesign。
- 页面只组合业务区块；弹窗、表格、状态、生命周期操作和图表必须下沉为可测试组件。

## 4. 依赖迁移

### 4.1 目标依赖

当前分支已经安装以下目标版本，实施第一阶段应先验证兼容并锁定，不重复升级：

| 职责 | 包 | 当前目标版本 |
| --- | --- | --- |
| 框架 | `vue` | `3.5.42` |
| 路由 | `vue-router` | `4.6.4` |
| UI | `tdesign-vue-next` | `1.20.7` |
| 图标 | `tdesign-icons-vue-next` | `0.4.9` |
| 状态 | `pinia` | `3.0.4` |
| 服务端缓存 | `@tanstack/vue-query` | `5.102.8` |
| 趋势图 | `@antv/g2` | `5.4.8` |
| 拓扑图 | `@antv/g6` | `5.1.1` |
| 构建 | `@vitejs/plugin-vue` | `5.2.4` |
| Vue 类型检查 | `vue-tsc` | `3.3.11` |
| 组件测试 | `vitest`、`@vue/test-utils`、`jsdom` | 已安装版本 |
| E2E | `@playwright/test` | `1.63.0` |

继续保留 `axios`、`zod`、Space Grotesk、Geist Mono 和既有 Sites 运行文件。

当前工作区已经写入上述依赖，因此实施时先执行 `npm install` 校验 lockfile 即可；若从尚未加入目标依赖的干净基线启动，使用以下命令，并由 npm 统一更新 lockfile：

```bash
npm install vue@3.5.42 vue-router@4.6.4 tdesign-vue-next@1.20.7 \
  tdesign-icons-vue-next@0.4.9 pinia@3.0.4 @tanstack/vue-query@5.102.8 \
  @antv/g2@5.4.8 @antv/g6@5.1.1
npm install -D @vitejs/plugin-vue@5.2.4 vue-tsc@3.3.11 \
  vitest@3.2.7 @vue/test-utils@2.5.0 jsdom@26.1.0 @playwright/test@1.63.0
```

### 4.2 目标脚本

```jsonc
{
  "scripts": {
    "dev": "vite",
    "typecheck": "vue-tsc --noEmit",
    "test:unit": "vitest run",
    "test:contracts": "node --test tests/*.test.mjs",
    "test:e2e": "playwright test",
    "test": "npm run test:contracts && npm run test:unit",
    "build": "npm run typecheck && vite build && node scripts/prepare-sites-build.mjs",
    "test:sites": "node --test tests/sites-worker.test.mjs",
    "check:architecture": "node scripts/check-frontend-stack.mjs"
  }
}
```

### 4.3 最终删除项

页面全部切换并通过验收后一次性执行依赖清理：

```bash
npm uninstall react react-dom react-router-dom @tanstack/react-query \
  antd @ant-design/icons echarts echarts-for-react @vitejs/plugin-react
npm uninstall -D @types/react @types/react-dom
```

同时删除全部 `.tsx`/React 专用文件和 React JSX compiler 配置。`package-lock.json` 必须由 npm 正常重算，不手工编辑。

新增架构检查脚本，至少失败于以下情况：

- `package.json` 再次出现 React、Ant Design、ECharts 或其他 UI/图表库。
- `src/` 出现 `react`、`antd`、`@ant-design/icons`、`echarts` 导入。
- `src/` 出现新的 `.tsx` 文件。
- 页面直接 `new Chart()`/`new Graph()` 而绕过统一 AntV composable。

## 5. Vite、TypeScript 与入口改造

### 5.1 Vite

- `vite.config.mjs` 将 `@vitejs/plugin-react` 换为 `@vitejs/plugin-vue`。
- `optimizeDeps.include` 从 React 入口改为 Vue/TDesign 必需依赖，避免无依据地全量预打包 AntV。
- `server.warmup.clientFiles` 改为 `./src/main.ts`。
- 保留 `build.outDir = dist/client`、`/eventmesh/dashboard` 代理、host 和 Sites 相关配置。
- 为页面和 AntV 建立懒加载边界；建议通过路由动态 import，而不是先写大而全的 `manualChunks`。

### 5.2 TypeScript

- `tsconfig.json` 移除 `jsx: react-jsx`，include 增加 `src/**/*.vue`。
- 增加 `src/env.d.ts`，引用 `vite/client` 并声明 `*.vue` 模块（如工具链需要）。
- 类型检查命令切换为 `vue-tsc --noEmit`。
- 页面和组件启用 `<script setup lang="ts">`；不再依赖 `strict: false` 隐藏 props/emits 错误。迁移期先维持当前 strict 值，待主迁移通过后单独收紧，避免一次引入两类变量。

### 5.3 应用入口

- `index.html` 的挂载节点由 `root` 改为 `app`，入口改为 `/src/main.ts`。
- `main.ts` 依次安装 Pinia、Vue Query、Router 和 TDesign，加载 TDesign 基础样式、字体和 EventMesh token。
- `App.vue` 只承载 TDesign 全局配置、消息/弹窗宿主和 `<RouterView />`，不再承载页面业务。
- Vue Query 默认配置保持现值：retry=false、staleTime=15s、refetchInterval=10s、refetchOnWindowFocus=false；首页生命周期写操作继续禁止自动重试。

## 6. 路由迁移

### 6.1 路由表

使用 `createRouter(createWebHistory())` 和命名路由。保持以下 URL 不变：

| URL | Vue Route | 页面 |
| --- | --- | --- |
| `/overview` | redirect | `/clusters` |
| `/clusters` | `clusters` | 全部集群首页 |
| `/clusters/:clusterId` | redirect | 当前兼容默认详情 |
| `/clusters/:clusterId/:view` | `cluster-view` | summary/overview/topology/relations/runtime/meta/storage/topics/connections/consumers/operations/configuration |
| `/clusters/:clusterId/storage/:engine/:storageClusterId/:panel?` | `storage-console` | Kafka/RocketMQ 控制台 |
| `/clusters/:clusterId/:componentType/:componentClusterId/:panel?` | `component-console` | Runtime/Meta 控制台 |
| `/topics`、`/groups`、`/operations` | legacy redirect | `/clusters` |
| `/:pathMatch(.*)*` | catch-all | `/clusters` |

实现要求：

- 把 `Shell` 拆为父布局路由，库存首页隐藏侧栏，集群详情显示集群作用域侧栏。
- 在 `beforeEach` 或 route props 规范化 `view/engine/panel`；非法值 replace 到对应 overview，不能制造浏览器历史垃圾。
- 保留 `src/routes.ts` 的纯函数语义，可迁名为 `router/paths.ts`；现有 Node 路由测试应原样通过。
- topology 的 `mode/node/q/component/status/kind` 继续由 query 驱动；切换非 topology 页面时按现有规则清除，其他 query 如 `source` 保留。
- `section` 继续承载一级模块下的二级导航，菜单展开状态可放在布局局部 state，不写入全局 Store。
- 使用 route name + params 构造内部导航；对外分享路径仍通过路径 helper 生成，避免散落字符串拼接。
- 路由页面使用动态 import，实现首页、集群详情、存储控制台、组件控制台和拓扑的独立 chunk。

### 6.2 路由验收

- 现有 `tests/routes.test.mjs` 全量通过。
- 直接刷新每个深层 URL 不出现 404，Sites Worker 仍回退到 `index.html`。
- 浏览器前进/后退能恢复 `section` 和 topology 筛选。
- 中英文切换、刷新和集群切换不丢失当前合法路由状态。

## 7. 核心组件适配

### 7.1 UI 映射

| 当前实现 | 目标实现 | 适配重点 |
| --- | --- | --- |
| `ConfigProvider` / `AntApp` | `TConfigProvider` + TDesign 插件/全局反馈 API | locale、全局 token、消息和确认框宿主 |
| `Button` | `TButton` | `theme/variant/status/loading/disabled` 语义，危险操作保持二次确认 |
| `Input` / `InputNumber` | `TInput` / `TInputNumber` | Vue `v-model`、clear、Enter、前后缀 slot |
| `Select` | `TSelect` / `TOption` | option 数据形状、filter、空值和宽度 |
| `Modal` | `TDialog` | visible 双向绑定、confirm/cancel、异步 loading、footer slot |
| `Alert` | `TAlert` | theme、title/message slot、关闭行为 |
| `Spin` | `TLoading` | 局部容器加载与全页加载分离 |
| `Tag` | `TTag` | 不依赖彩色 pill 表达状态，继续配合图标/文字/结构线 |
| `Tooltip` | `TTooltip` | disabled 元素包裹、侧栏折叠提示 |
| `Tabs` | `TTabs` / `TTabPanel` | active value 与路由 query 同步，不维护第二份状态 |
| `Pagination` | `TPagination` | 页码基准、total、page-size 与后端契约一致 |
| `Tree` | `TTree` | topology 资源树 expanded/selected/filter 状态和祖先自动展开 |
| `Dropdown` | `TDropdown` | action key 与点击冒泡；表格行点击不能吞掉菜单操作 |
| `Checkbox.Group` | `TCheckboxGroup` | 关系/复制选择、禁用项、复杂 label slot |
| Ant Icons | `tdesign-icons-vue-next` | 建立统一 `AppIcon`/语义图标映射，不在页面散落动态图标判断 |

优先迁移的共享组件：

1. `StatusBadge.vue`：保留 normal/warning/abnormal/unknown 的图标、文本和结构提示。
2. `LifecycleStatus.vue` 与 `LifecycleActions.vue`：保留 `DeployStatusType`、并发动作禁止、确认及危险注销确认。
3. `ResourceTable.vue`：明确 props、slots、row-key、search、loading、empty、refresh 和 row action 事件。
4. `CreateNodeDialog.vue`、`CreateTopicDialog.vue`、`CreateConsumerDialog.vue`：使用 typed props/emits 和表单校验，不在弹窗内部直接改 Store。
5. `SourceTag.vue`、`ApiError.vue`、`PageHeading.vue`：统一 Live/Mock/Partial Live 和异常表达。
6. `AppShell.vue`、`ClusterNavigation.vue`、`StatusBar.vue`：稳定后再迁页面，避免每页各自实现导航和反馈。

### 7.2 React 到 Vue 的状态语义

- `useState` -> `ref/reactive`；大型只读数据优先 `shallowRef`，避免深层代理成本。
- `useMemo` -> `computed`；不得在 computed 内写状态或发请求。
- `useEffect` -> `watch/watchEffect/onMounted/onBeforeUnmount`；所有 interval、timeout、DOM listener、ResizeObserver 和 AntV 实例必须显式清理。
- `useRef` DOM 引用 -> template ref。
- React props callback -> Vue typed `defineEmits`；双向值仅在控件需要时使用 `defineModel`/`v-model`。
- `dangerouslySetInnerHTML`（如后续出现）不得直接机械迁移，必须先确认内容可信或做清洗。

### 7.3 不迁移的遗留组件

先按当前路由做可达性审计。`App.tsx` 中没有被路由或可达页面引用的历史 Overview/Resource/ClusterDetail 等组件不做 Vue 1:1 翻译；以删除测试和功能清单确认无业务缺失后直接移除。这样可以避免把旧实现和重复页面永久带入新架构。

## 8. 数据请求、状态与 i18n

### 8.1 Vue Query

- 保留现有 query key 的业务含义，集中到 `queryKeys.ts`，避免迁移中出现双缓存。
- 把 `useQuery/useMutation/useQueryClient` 替换为 Vue Query API；在 queryFn 中对 `ref` 使用 getter/unref，确保 clusterId 变化会重新取数。
- loading、fetching、error、partial warnings 必须保持不同 UI 状态，不能统一成一个 spinner。
- 生命周期 mutation 保留 receipt 校验、mock ID 拒绝和禁止自动重试的现有契约。
- repository、Axios client、Zod schema 维持纯 TS，无需重写成 Vue service。

### 8.2 Pinia

建立三个职责清晰的 Store：

- `useMockClusterStore`：关系和前端可写资源。
- `useMockLifecycleStore`：状态机、操作历史、定时器与恢复规则。
- `useCopyTaskStore`：复制任务、进度和复制后集群。

兼容要求：

- 沿用现有 localStorage key 和 schema version；启动时继续执行 normalize，不直接信任存量 JSON。
- 保留跨 Tab `storage` 事件同步。
- 定时器句柄不持久化；Store dispose/HMR 时清理。
- action 是唯一写入口；组件不得直接改持久化 state。
- 先用已有纯函数做 Store 单元测试，再测试 Vue 组件绑定，避免状态机逻辑随框架重写。

### 8.3 i18n

为满足“不引入其他组件/框架”的约束，不额外引入 i18n 库。把当前字典迁到纯 TS，使用一个轻量 `useI18n` composable + provide/inject 或 Pinia：

- 保留 `eventmesh-language` localStorage key 和浏览器语言默认选择。
- 暴露 `language`、`locale`、`t`、`toggleLanguage`。
- TDesign locale 通过 computed 配置同步切换。
- 字典 key 在迁移过程中保持稳定，增加缺失 key 的开发环境告警测试。

## 9. AntV 可视化迁移

### 9.1 趋势图：G2

- 使用当前未跟踪的 `src/composables/useG2Chart.ts` 和 `trendChartOptions.ts` 作为起点，先补单元测试和一个 `TrendChart.vue` 宿主组件，再接页面。
- `TrendChart.vue` 统一接收 `{ points, unit, source, status }`，负责 loading/empty/error/ready 四态；页面不传 G2 options。
- 把 ECharts 的宽表 series 转成 G2 长表 `{ time, series, value }`，保留 null，不把缺失值伪造为 0。
- 迁移 `MessageRateChart`、`RuntimeResourceChart`、`MonitorTrendChart`、`StorageRateChart`、`ComponentTrendChart`，通过配置表达颜色、单位、区域填充和 tooltip。
- 使用 `ResizeObserver`、动态 import、渲染串行化和 `destroy()`；路由切换后不得残留 canvas 或 listener。
- 保持 EventMesh token：主色 `#225aa0`、稀疏使用 cyan `#4cb6d4`、辅助 slate；图表不得重新引入红黄蓝绿状态编码。

### 9.2 拓扑图：G6

- 关系图模式使用 G6，资源树模式继续使用 TDesign Tree；二者共享当前 `topologyTree.ts` 的框架无关模型和 URL 状态。
- 建立 `useTopologyGraph.ts`，唯一负责 Graph 创建、数据更新、事件绑定、ResizeObserver、布局切换和销毁。
- 将三层 drill-down、整卡进入、节点 inspector、搜索选中和 hover 高亮映射为 G6 node/edge state。
- 连接边保持现有产品约束：虚线本身做方向动画，目标端只有一个 arrowhead；单一 Event Store 依赖是一条连续目标色竖向路径；缺失源/目标组件时不渲染边。
- G6 自定义节点只表达现有卡片 anatomy，不引入新的业务字段或假指标。
- 图和树切换时保留 search 和 selected node；资源树筛选自动展开祖先，且虚拟目录明确标记为非拓扑关系。

### 9.3 可视化验收

- 同一数据输入下，图例、series、单位、tooltip 和空值语义与旧页面一致。
- 容器 resize、侧栏折叠、tab 切换和路由离开/返回无重叠 canvas、重复事件或内存持续增长。
- topology 的 query deep link 能恢复 mode、筛选、层级和选中节点。
- 动画遵守 `prefers-reduced-motion`；图表/拓扑有可读标题、文本摘要或树形替代，不能只靠 Canvas 传达状态。

## 10. 样式兼容策略

### 10.1 Token 层

新增 `styles/tokens.css`，先定义 EventMesh 语义变量，再映射到 TDesign 支持的主题变量：

```css
:root {
  --em-primary: #225aa0;
  --em-cyan: #4cb6d4;
  --em-page: #f2f7fc;
  --em-surface-soft: #f8fbfe;
  --em-border: #d4e1ef;
  --em-text: #203247;
  --em-text-strong: #1f1f1f;
  --em-text-secondary: #5f7388;
  --em-normal: #2c7568;
  --em-warning: #9a5b00;
  --em-abnormal: #a9433c;
  --em-unknown: #64768a;
}
```

TDesign token 名称以安装版本的实际 CSS 为准后映射，禁止在方案阶段猜测并写死不存在的变量。

### 10.2 CSS 迁移规则

- 保留不依赖组件库 DOM 的布局类，如 shell、workspace、panel、table layout、topology canvas 和响应式网格。
- 94 处 `.ant-*` 按组件逐一归属：能用 TDesign props/token 完成的删除；确需覆盖的放到组件 scoped CSS 的 `:deep(.t-*)`，并写明原因。
- 不做全局 `.ant-* -> .t-*` 文本替换，因为两套组件 DOM、状态类和尺寸模型不同。
- 表格行高、按钮高度、Dialog 宽度、Select/Input 宽度以页面 wrapper 类控制，避免依赖组件内部节点层级。
- 先加载 TDesign reset/base，再加载 EventMesh token 和业务样式；用固定顺序消除 CSS 偶然优先级。
- 保持字体：界面 Space Grotesk，技术字段 Geist Mono，中文回退 PingFang SC/Microsoft YaHei。
- 保持桌面高密度和移动端响应式；每个迁移页面分别在宽屏、约 1366px 和 760px 以下验收。
- 状态继续使用图标、文字、形状/边线和灰度共同表达，不只改颜色。

### 10.3 样式完成门禁

- `rg '\.ant-|--ant-' src` 返回空。
- 页面组件不得依赖未封装的 `.t-*` 深层结构；允许项写入小型白名单并附原因。
- 关键路由截图与当前选定视觉基线做对比，重点检查导航、密度、表格、Dialog、状态和拓扑层级。
- 键盘 focus、hover、disabled、loading、empty、error 和危险确认状态均有可视反馈。

## 11. 分阶段实施计划

每阶段应独立提交、可验证、可回退；工作量由负责人结合页面截图和交互清单估算，不在缺少团队基线时编造人日。

### 阶段 0：冻结契约与修复基线

- 保存当前关键路由截图、URL/query 矩阵和交互清单。
- 修复两个测试的过时 import 路径，使迁移前测试全绿。
- 为 localStorage schema、生命周期状态机、copy task 和 API query key 增加必要契约测试。
- 建立 React/AntD/ECharts 使用清单和可达性清单，确认哪些 `App.tsx` 历史组件可直接删除。
- 门禁：`npm test`、`npm run typecheck`、`npm run build`、`npm run test:sites` 全绿。

### 阶段 1：搭建 Vue 基础设施（尚不切生产入口）

- 新增 Vue bootstrap、Router、Pinia、Vue Query、TDesign locale/theme、i18n composable 和基础 token。
- 完成 Vite/tsconfig 的 Vue 候选配置，可用单独的临时入口或测试配置验证，但不在同一页面挂载双框架。
- 建立 `check:architecture`，迁移期用 allowlist 标记剩余 React 文件；每阶段只减不增。
- 门禁：Vue smoke component 可渲染；纯 TS 契约测试不受影响。

### 阶段 2：迁移全局壳和共享组件

- 迁移 AppShell、顶部栏、侧栏、面包屑、状态栏、TDesign 全局反馈。
- 迁移 StatusBadge、Lifecycle、ResourceTable、PageHeading、ApiError 和创建类 Dialog。
- 统一图标映射和样式 token，先消灭共享 CSS 中的 Ant 选择器。
- 门禁：布局、导航折叠、语言、刷新、确认框、消息、表格基础状态组件测试通过。

### 阶段 3：迁移首页和 EventMesh 集群页面

- 先迁 `/clusters`，再按 summary -> overview -> relations -> runtime/meta/storage 列表 -> topics/connections/consumers/operations 顺序迁移。
- 每次只迁一个页面纵切片：View + query + mutation + dialog + styles + tests；不改变其他页面后端集成。
- 把 copy task state 从页面抽到 Pinia，并验证刷新/跨页面/完成历史语义。
- 门禁：每个已迁 URL 的数据来源标签、写操作确认、空态、错误和回退与旧实现一致。

### 阶段 4：迁移嵌套 Runtime、Meta、Kafka、RocketMQ 控制台

- 迁 Runtime/Meta 控制台的 overview、nodes/instances、connections/registry、topics/subscriptions、relations。
- 迁 Kafka/RocketMQ 的 overview、broker/NameServer/controller、physical topic、consumer group、relations。
- 保持 Kafka KRaft 与 RocketMQ Master/Slave 的不同部署语义，不合并成泛化 broker 页面。
- 门禁：所有深层 URL 可刷新、可返回、可复制；Mock/Live 边界不变。

### 阶段 5：迁移 AntV

- 先接 `TrendChart.vue` 并逐一替换 5 类 ECharts 图。
- 再用 G6 迁关系 topology，TDesign Tree 迁资源树，完成 inspector 和 URL 状态恢复。
- 对 AntV chunk 使用路由/组件动态加载，记录构建体积对比。
- 门禁：源码无 ECharts 引用；图表和 topology 的交互、resize、销毁、无数据和 reduced-motion 测试通过。

### 阶段 6：原子切换与旧栈清理

- 将 `index.html` 正式切到 `main.ts`，删除 React 入口和所有已确认无用/已迁 `.tsx`。
- 卸载 React、React Router、React Query、Ant Design、Ant Icons、ECharts 和 React Vite plugin。
- 清除 `.ant-*` 样式、React JSX 配置、临时兼容 allowlist 和双栈测试入口。
- 门禁：`check:architecture` 证明旧框架/UI/图表引用为零；生产构建只包含 Vue/TDesign/AntV UI 栈。

### 阶段 7：全量回归与 Sites 交付

- 跑契约、组件、路由、E2E、视觉、可访问性和构建体积检查。
- 本地启动服务并在浏览器逐页检查关键路由和控制台错误。
- 执行 `npm run build` 和 `npm run test:sites`，确认 `dist/client/index.html`、`dist/server/index.js`、`dist/.openai/hosting.json`。
- 观察 API 请求次数、轮询、内存和图表资源释放，确认没有重复请求或实例泄漏。

## 12. 测试与验收矩阵

| 层级 | 重点 | 工具/门禁 |
| --- | --- | --- |
| 纯函数契约 | API envelope、Zod、路径、拓扑树、Mock normalize、状态机 | Node test，复用现有测试 |
| Store | hydrate、action、跨 Tab、定时器、HMR dispose | Vitest fake timers |
| Composable | Vue Query key/reactivity、G2/G6 生命周期、i18n | Vitest + jsdom |
| 组件 | props/emits、loading/error/empty、Dialog 表单、Table actions | Vue Test Utils |
| 路由 | redirect、非法参数、query 保留/清理、深层 URL | memory history + Playwright |
| 页面 E2E | 首页、详情、关系、生命周期、复制、新建、嵌套控制台 | Playwright |
| 视觉 | shell、表格、Dialog、状态、图表、topology、移动端 | 稳定数据截图对比 |
| 架构 | 禁止旧包、禁止 `.tsx`、禁止页面直接创建 AntV 实例 | `check:architecture` |
| 构建 | typecheck、chunk、Sites 三项产物、Worker fallback | build + `test:sites` |

最终验收条件：

1. 所有当前可达 URL 和查询参数行为兼容，浏览器刷新和历史导航正常。
2. 后端请求、错误语义、Mock/Live 标记、localStorage 数据和生命周期状态机无回归。
3. React、Ant Design、Ant Icons、ECharts 的 dependencies、imports、样式选择器和运行时代码全部为零。
4. 所有可视化由 G2/G6 承担，资源树由 TDesign Tree 承担；无重复图表实例和事件泄漏。
5. 视觉层级、密度、响应式、状态语义和可访问性满足现有 EventMesh 设计约束。
6. 全量测试、生产构建和 Sites 测试通过，浏览器控制台无 error。

## 13. 发布、回滚与风险

### 13.1 发布与回滚

- 不在生产运行时做按用户灰度的 React/Vue 双入口；这是前端整体框架切换，双入口会放大缓存、路由和状态差异。
- 使用分阶段提交与最终原子切换。发布前保留 React 最后可发布 commit/tag，Vue 构建失败或核心路由回归时直接回滚静态产物/commit。
- localStorage schema 保持向后兼容，使静态资源回滚后用户的 Mock 数据仍可读取；若未来必须升级 schema，先增加向前/向后迁移器并单独评审。
- 后端和数据库未修改，因此回滚不涉及服务端数据恢复。

### 13.2 主要风险

| 风险 | 影响 | 缓解与触发信号 |
| --- | --- | --- |
| 机械翻译导致响应式时序变化 | 重复请求、旧 clusterId 数据闪现 | Vue Query key 使用 getter；路由切换 E2E 检查请求次数 |
| TDesign DOM 与 AntD 不同 | 94 处样式失效、密度偏移 | 按组件迁 CSS，禁止全局选择器替换，逐页截图验收 |
| G2/G6 生命周期处理不当 | Canvas 泄漏、页面卡顿 | 统一 composable、ResizeObserver、destroy、内存/导航压力测试 |
| `App.tsx` 职责过多 | 漏迁可达功能或迁入废代码 | 路由可达性清单 + 交互截图；未路由组件不做盲目移植 |
| localStorage Store 重写 | 用户 Mock 数据丢失、状态机异常 | key/version 不变，normalize 契约测试，旧数据 fixture 回放 |
| 双栈依赖长期残留 | 包体积和维护成本增加 | 每阶段 allowlist 只减不增，最终架构检查硬失败 |
| AntV/TDesign 包体积 | 首屏性能继续恶化 | 页面/图表动态 import，比较当前 2.5 MB 基线，按路由检查 chunk |
| 现有失败测试污染判断 | 无法判断 Vue 回归 | 阶段 0 先修正两个测试 import，建立全绿 baseline |

## 14. 已定决策与待确认项

已定：

- 目标 UI 技术栈只允许 Vue + TDesign + AntV；不保留 React、AntD、ECharts 兼容层。
- 采用 Vue 3 Composition API + `<script setup>`。
- G2 负责趋势统计图，G6 负责关系拓扑，TDesign Tree 负责资源树。
- 保留当前后端契约、URL、视觉方向、Mock/Live 边界和 Sites 构建协议。
- 新功能只在 Vue 目标架构中实现。

实施前由前端负责人确认、但不阻塞本计划评审的事项：

- 是否把 `strict` 收紧作为本次迁移末期任务，还是拆为后续专项。建议拆开，避免框架迁移和类型债务同时扩大回归面。
- 视觉回归采用当前关键路由截图还是正式设计稿作为逐像素基线。若没有稳定设计稿，建议以当前选定 EventMesh 视觉方向 + 关键路由截图为准。
- 最终 bundle 预算需在阶段 1 采集 Vue 空壳与 TDesign/AntV 分包数据后设定；当前只能以旧构建约 2.5 MB / gzip 798 KB 作为对照，不能凭空承诺目标数值。
