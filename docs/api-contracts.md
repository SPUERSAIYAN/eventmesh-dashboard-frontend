# EventMesh Dashboard API contracts

The current backend source is the only contract baseline. The frontend calls it through `/eventmesh/dashboard`, sends no token, and reads `organizationId` from `VITE_EVENTMESH_ORGANIZATION_ID` (default `1`).

## Enabled APIs

| Frontend use | Method and path |
| --- | --- |
| Cluster list | `POST /user/cluster/queryClusterByOrganizationIdAndType` |
| Cluster creation | `POST /organization/activeCreate/createCluster` |
| Runtime list / detail | `POST /runtime/queryRuntimeListByClusterId`, `POST /runtime/queryRuntimeListById` |
| Cluster tree | `POST /user/cluster/queryTreeByClusterId` |
| Topics | `POST /user/topic/queryTopicListByClusterId` |
| Groups by cluster / Topic | `POST /user/group/queryGroupListByClusterId`, `POST /user/group/queryGroupListByTopicId` |
| Configuration | `POST /user/config/queryByInstanceId` |
| Operations | `POST /cluster/log/getList` |

All list requests carry `queryClause: {"limitPageNum":1,"limitSize":200}`. Raw and nested envelopes are unwrapped. An HTTP 200 response whose business `code` is not `0` or `200` is treated as a failure.

## Deliberately excluded

Authentication, members, role permissions, EventMesh-space creation, direct-relation querying, connections, ACL, health, configuration updates, Runtime creation, Topic writes, and consumer-group writes are not exposed. The normal cluster creation form is exposed by explicit product requirement, but the current backend handler still fails before persistence because it does not populate required cluster and relationship fields. The frontend displays that failure and never reports a false success.

Empty lists remain valid empty states. A failing sibling request produces a partial-data state without fabricated metrics. CPU, memory, throughput, lag, connection counts, and health scores are never synthesized.
