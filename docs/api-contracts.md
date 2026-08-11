# EventMesh Dashboard API contracts

Backend base URL in the development profile:

`http://127.0.0.1:9898/eventmesh/dashboard`

The frontend uses `/eventmesh/dashboard` and lets the Vite development proxy forward it to the backend. Runtime configuration is documented in `.env.example`.

## Endpoints used by the first dashboard screens

| Frontend use | Method and path | Request | Controller | Response used |
| --- | --- | --- | --- | --- |
| Cluster list | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `{ organizationId, clusterType }` | `ClusterController` | `ClusterEntity[]` |
| Runtime list/count | `POST /runtime/queryRuntimeListByClusterId` | `{ clusterId, organizationId, clusterType }` | `RuntimeController` | `RuntimeEntity[]` |
| Topic count | `POST /user/topic/queryTopicListByClusterId` | `{ clusterId, organizationId, clusterType, topicName }` | `TopicController` | `TopicEntity[]` |
| Consumer-group count | `POST /user/group/queryGroupListByClusterId` | `{ clusterId, organizationId, clusterType }` | `GroupController` | `GroupEntity[]` |
| Runtime health score | `GET /cluster/health/getInstanceLiveProportion` | query: `instanceType=2&theClusterId={id}` | `HealthController` | `{ abnormalNum, allNum }` |
| Network connections | `POST /netConnection` | optional `{ clusterId, runtimeId, clientHost }` | `NetConnectionController` | `NetConnectionEntity[]` |
| Operation history | `POST /cluster/log/getList` | optional operation filters | `LogController` | `LogEntity[]` |

The JMX file confirms the backend host, port, context path, cluster query payload, and Runtime request. The Controller source is treated as authoritative where the JMX is stale or incomplete.

All paginated list requests include this header:

`queryClause: {"limitPageNum":1,"limitSize":200}`

The Decoration interceptor uses `queryClause` and caps `limitSize` at 200. The older
`queryClause1` value in the JMX file is stale and produces a `must queryClause` response.

## Known backend limitations

- `queryClusterDetails` currently creates and returns an empty `ClusterDetailsVO`; it cannot supply the screen yet.
- `queryHomeClusterData` is declared as `GET` with a required request body. Browsers do not reliably send GET bodies, so the frontend derives counts from the POST list APIs instead.
- No complete Controller contract currently exposes the throughput time series used by the selected design.
- No Controller currently exposes the “recent changes” activity feed.
- `ClusterEntity` has no region or user-facing external cluster identifier.
- `RuntimeEntity` does not expose CPU, memory, or connection metrics.

When the API is connected, missing metric fields are displayed as unavailable and the result is
reported as `mixed`; mock values are not merged into a successful API response. If the backend
itself is unreachable, invalid, or times out, the affected dashboard query falls back to local
development data and reports `mock`.

## Fallback behavior

1. Call the real endpoint with a 3.5-second default timeout.
2. Unwrap raw, decorated, or paged response envelopes.
3. Validate cluster, Runtime, and health responses with Zod.
4. Keep successful endpoint results even when sibling endpoints fail.
5. Show fields without database contracts as unavailable when the API is connected.
6. Use `src/data/dashboard.js` only if the affected API query cannot be completed.
7. Expose `live`, `mixed`, or `mock` source metadata to the UI.

The fallback is intended for local visual development and incomplete backend contracts. It should not hide production incidents; production deployments can surface the source metadata in monitoring and error reporting.
