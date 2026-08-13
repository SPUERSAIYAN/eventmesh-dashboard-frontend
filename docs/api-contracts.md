# EventMesh Dashboard API contracts

The production frontend calls the backend through the same-origin prefix `/eventmesh/dashboard`. Every business request carries a Bearer access token and the active organization is read from the authenticated session.

## Authentication and organization APIs

| Use | Method and path | Response used |
| --- | --- | --- |
| Sign in | `POST /auth/login` | access/refresh tokens, user, organizations, current organization and role |
| Rotate session | `POST /auth/refresh` | replacement access and refresh tokens |
| Sign out | `POST /auth/logout` | `204` after refresh-session revocation |
| Restore identity | `GET /auth/me` | current user, organizations and role |
| Organizations | `GET /organizations` | organizations visible to the signed-in user |
| Members | `GET/POST /organizations/{id}/members` | organization member directory and creation |
| Member role/removal | `PATCH/DELETE /organizations/{id}/members/{userId}` | role update or membership deactivation |

## Resource APIs

| Frontend use | Method and path | Response used |
| --- | --- | --- |
| Cluster list | `POST /user/cluster/queryClusterByOrganizationIdAndType` | `ClusterEntity[]` |
| Basic cluster creation | `POST /organization/activeCreate/createCluster` | generated cluster ID |
| Runtime list | `POST /runtime/queryRuntimeListByClusterId` | `RuntimeEntity[]` |
| Topics | `POST /user/topic/queryTopicListByClusterId` | `TopicEntity[]` |
| Consumer groups | `POST /user/group/queryGroupListByClusterId` | `GroupEntity[]` |
| Health | `GET /cluster/health/getInstanceLiveProportion` | `{ abnormalNum, allNum }` |
| Connections | `POST /netConnection` | `NetConnectionEntity[]` |
| Operations | `POST /cluster/log/getList` | `LogEntity[]` |

All list requests include:

```text
queryClause: {"limitPageNum":1,"limitSize":200}
```

The production profile enables the backend Decoration/PageHelper integration so this header is applied consistently. Raw, decorated and nested response envelopes are unwrapped by the client before validation.

## Data and failure rules

1. Production does not import or fall back to `src/data/dashboard.js`.
2. A successful empty or `null` list is normalized to an empty list.
3. Contract violations, HTTP errors and timeouts are shown as explicit error states.
4. Successful sibling endpoints remain visible when another detail endpoint fails.
5. CPU, memory and throughput remain unavailable until typed backend contracts exist.
6. Operation audit is never requested or rendered for organization members.
7. Unsupported script, metadata-file and copy creation flows are not exposed.

The backend validates both `organizationId` and `clusterId`. Changing either identifier outside the active organization returns HTTP 403 for non-system users.
