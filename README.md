# EventMesh Dashboard Frontend

React + Vite frontend for the EventMesh Dashboard console. The development server proxies
`/eventmesh/dashboard` to the Spring Boot backend at `http://127.0.0.1:9898`.

## Local services

- MySQL container: `eventmesh-dashboard-mysql` on `127.0.0.1:3306`
- Database: `eventmesh_dashboard`
- Spring Boot API: `http://127.0.0.1:9898/eventmesh/dashboard`
- Frontend: `http://localhost:4173`

Cluster, Runtime, Topic, Consumer Group, connection, operation, and health data come from the
backend API and MySQL. When the API is connected, fields without a database-backed Controller
contract are displayed as unavailable instead of being filled with fabricated metrics. The
local dataset is used only when the backend request itself is unavailable.

See [docs/api-contracts.md](docs/api-contracts.md) for the endpoint mapping and fallback rules.
