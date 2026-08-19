# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Backend dependency and change boundary

- This frontend project depends on the backend project at `/Users/lijiahao/Documents/EventMesh/eventmesh-dashboard`.
- Treat the backend repository as read-only context. It may be inspected to understand API contracts, authentication, permissions, response structures, database-backed capabilities, and runtime configuration, but its code and configuration must not be modified from frontend tasks.
- Do not change backend Java code, Maven configuration, resource files, SQL or Flyway migrations, deployment files, or backend tests to accommodate frontend implementation.
- Treat the current backend source as the contract baseline; stale classes found only in old build output are not product capabilities. The frontend console is intentionally unauthenticated because the current source has no completed authentication, organization-member, or role-permission contract.
- Read the organization ID from `VITE_EVENTMESH_ORGANIZATION_ID` with a default of `1`. Implement compatibility, data transformation, fallback display, error handling, routing, and interaction changes entirely inside `/Users/lijiahao/Documents/EventMesh/eventmesh-dashboard-frontend`.
- If a requested frontend capability cannot be implemented against the existing backend contract, report the missing backend capability explicitly and keep the backend unchanged. Do not fabricate operational data or silently introduce a backend change.
- The local frontend development server proxies `/eventmesh/dashboard` to the backend at `http://127.0.0.1:9898` by default. Keep backend-dependent frontend behavior aligned with the actual endpoints exposed by the backend project.

## Local simulation data

- The local MySQL development database may contain explicit simulation records requested for UI coverage. Prefix all such names or descriptions with `codex-sim-` / `codex-sim:` so they remain identifiable and can be removed independently from existing data.
- Simulation records may cover varied cluster types, recursive relationships, active/offline states, long names, Runtime versions, Topics, consumer groups, configuration, and operation outcomes. This does not authorize the frontend to invent fields or metrics that the backend API did not return.

## Selected visual direction

- Use `/Users/lijiahao/.codex/generated_images/01a00941-4d37-7dd2-ad69-2828ad2bfcbe/exec-b2674412-2046-4647-91bc-45aee5cc94ad.png` as the current source of truth.
- Use an Alibaba Cloud-like neutral console system grounded in the real EventMesh logo: white, near-black, and cool gray surfaces with EventMesh deep blue `#225aa0` as the primary accent for actions, active navigation, focused links, and attention markers. Keep the logo's lighter cyan `#4cb6d4` secondary and sparse; do not use gradients.
- Use bright black `#1f1f1f` for primary interface text and headings; preserve muted slate colors for secondary descriptions, metadata, and disabled content so hierarchy remains clear.
- Replace flat neutral gray backgrounds and borders with a restrained cloud-mist palette: page `#f2f7fc`, soft surfaces `#f8fbfe`, blue-gray border `#d4e1ef`, slate secondary text `#5f7388`, and slate primary text `#203247`. Keep content panels white and avoid turning every surface blue.
- Use a restrained operational status system that works with the cloud-mist palette: normal teal `#2c7568`, warning amber `#9a5b00`, abnormal brick red `#a9433c`, and unknown slate `#64768a`. Pair every state with a distinct Ant Design icon, text label, and structural cue such as a left rule or card top border; never rely on color alone.
- Use Space Grotesk Variable for the console interface and Geist Mono Variable for cluster IDs, addresses, versions, rates, timestamps, configuration values, and other technical data. Retain `PingFang SC` and `Microsoft YaHei` as Chinese glyph fallbacks.
- Keep console pages dense and task-driven. Prefer flat sections, dividers, tables, and master-detail layouts over card grids, nested cards, symmetric metric rows, decorative charts, large welcome copy, gradients, glass effects, colored pills, and marketing-style whitespace.
- Distinguish status using icons, text, shape, and gray intensity. Do not use a red/yellow/blue/green status palette.
- Preserve stable backend contracts, routes, and topology behavior. Do not fabricate operational metrics or actions that the backend does not support. Hide incomplete EventMesh-space creation, direct-relation query, connection, health, ACL, configuration-write, Runtime-write, Topic-write, and consumer-group-write capabilities. Live verification showed `createEventMeshSpace` fails because `replication_type` is null and `queryRelationClusterByClusterIdAndType` fails on an enum/string MyBatis comparison; keep both hidden until their backend loops are fixed.

## Cluster topology decisions

- Use `/Users/lijiahao/Documents/EventMesh/eventmesh-dashboard-frontend/eventmesh_dashboard_demo.html` as the visual and interaction source of truth for the cluster topology experience.
- Cluster topology must stay inside the existing EventMesh console shell. Keep the left navigation sidebar, console top bar, workspace gutters, and bottom status bar visible; do not switch the application shell to a full-screen topology mode.
- Preserve the reference HTML's three-level drill-down, animated directional relationships, whole-card entry, and node inspector while adapting the canvas to the console workspace width.
- Relationship arrows must follow the reference HTML's animated-path behavior: animate the dashed path itself and keep a single arrowhead at the target. Do not place a separate moving arrow glyph in the middle of a connector. A single Event Store dependency should use one continuous target-colored vertical path rather than a mixed-color trunk and branch.
- Render a relationship connector only when its source or target component exists in backend data. Empty-state placeholders must not display arrows that imply a nonexistent relationship.
- Keep authenticated console pages dense on desktop: page content should fill the available workspace instead of using a narrow centered maximum width, with consistent compact horizontal gutters that remain responsive on small screens.
- Keep dashboard overview typography comfortably readable after the dense-layout change: use larger heading, metric-label, inventory-row, and operation-row text while preserving card proportions and responsive wrapping.
- Keep the relationship graph as the default topology view and offer the resource tree as an in-page alternate view using `mode=tree`.
- The resource tree uses a compact master-detail layout for search and location. Include clusters, Runtime instances, Topics, and consumer groups. Do not add a connection directory until a stable source endpoint exists; represent Topic and consumer-group resources inside neutral virtual directories explicitly labeled as non-topology relationships.
- Preserve topology search and node selection while switching views, keep tree filters in shareable URL state, and automatically expand ancestor paths for filtered results.

## Mock cluster management prototype

- The all-clusters inventory homepage does not show a left sidebar; let the inventory workspace span the full console width. Restore the cluster-scoped left navigation only after entering a specific cluster.
- The cluster inventory is the console landing experience: `/overview` and `/clusters` both show all mock clusters before entering a cluster detail page.
- For this prototype phase, cluster inventory, cluster detail, resource utilization, Runtime/Meta summaries, MQ rates, whole-cluster copy, and add-node flows use clearly labeled frontend mock data and do not call backend resource APIs.
- Whole-cluster copy is available only from the cluster level. Its flow may select which Topics and consumer groups are included, but Topics and consumer groups do not expose standalone copy actions.
- After a whole-cluster copy starts, keep the mock task visible on the originating page with source and target clusters, copied resource counts, the current phase, progress, and completion status; a transient toast alone is not sufficient feedback.
- The copy-task progress panel is transient: show active tasks only on the all-clusters inventory or the selected cluster's `概要` page, never across Topic/Consumer/Topology or other cluster modules. Automatically remove the panel when all visible tasks succeed; completed results remain in `Operation / 操作历史`.
- Mirror whole-cluster copy tasks into the cluster `Operation / 操作记录` history. When a mock copy reaches success, add the target to the all-clusters inventory and allow users to enter it and inspect the copied cluster's overview, resources, nodes, messaging modules, and topology state.
- Adding a node is available only inside a selected cluster. Keep Runtime and Meta node roles visible in the add-node flow.
- The console landing route is the all-clusters inventory itself, not a generic overview page. Do not show a separate global “Overview / 概览” navigation item.
- Entering a cluster opens a distinct cluster-scoped management page. Its left navigation switches from global resources to cluster-local modules inspired by Know Streaming. Keep `Cluster topology` directly below `Cluster`, followed by Runtime/Broker, Topic, Connect, Consumer, Operation, Message, and Security. Keep Replication hidden until the product needs cross-cluster replication management.
- Show the large cluster identity header (cluster name, status, metadata, copy/add actions, and current-cluster heading) only inside the first-level `Cluster` module (`概要` and `集群拓扑`). Runtime/Broker, Topic, client connection, Consumer, Operation, Message, and Security pages start directly with their own module content and must not repeat this header.
- Treat each cluster module's `概览` destination as a monitoring summary with meaningful operational metrics and trends; do not duplicate the module's resource list there. Keep detailed Runtime and Meta node tables on their dedicated second-level destinations.
- Topic and Connections overviews must summarize their own health, throughput, latency, capacity, and trend signals; their sibling list destinations contain the resource-level details. Keep the sidebar collapse control outside the scrolling navigation area and fixed to the sidebar footer so long expanded menus cannot overlap it.
- Label the client-to-Runtime connection module as `客户端连接`; reserve `Connector / Pipeline` terminology for the separate data-integration capability.
- On cluster-scoped pages, group related left-navigation destinations under expandable first-level modules and show clickable second-level labels underneath, following the Know Streaming information-architecture logic while retaining the EventMesh visual system. Keep URL state and active highlighting synchronized with second-level selection.
- Keep the existing cluster topology experience available from the cluster-scoped page while the new mock management views are active.
