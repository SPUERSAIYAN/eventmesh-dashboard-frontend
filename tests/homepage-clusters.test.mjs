import assert from "node:assert/strict";
import test from "node:test";
import {
  mapHomepageCluster,
  mergeHomepageClusters,
  resolveHomepageDeployStatus,
} from "../src/data/homepageClusters.ts";

const entity = {
  id: 1001,
  name: "prod-eventmesh-east",
  description: "live description",
  version: "1.11.0",
  clusterType: "EVENTMESH_JVM_CLUSTER",
  deployStatusType: "PAUSE_SUCCESS",
  trusteeshipType: "TRUSTEESHIP",
  config: '{"region":"华东 1（杭州）","cloudProvider":"ACK","kubernetesCluster":"ack-east"}',
  homepageRuntimeCount: 3,
  homepageMetaNodeCount: 2,
  homepageNodeWarnings: [],
};

test("maps live core fields without borrowing mock metrics", () => {
  const result = mapHomepageCluster(entity, [{
    id: "mock-id",
    name: "prod-eventmesh-east",
    description: "mock description",
    cpu: 46,
    memory: 62,
    runtimes: 6,
    metaNodes: 3,
    inRate: 92340,
    outRate: 74620,
  }]);
  assert.equal(result.id, "1001");
  assert.equal(result.mockRouteId, "mock-id");
  assert.equal(result.description, "live description");
  assert.equal(result.backendDeployStatus, "PAUSE_SUCCESS");
  assert.equal(result.hostingType, "托管");
  assert.equal(result.region, "华东 1（杭州）");
  assert.equal(result.cpu, null);
  assert.equal(result.runtimes, 3);
  assert.equal(result.metaNodes, 2);
  assert.equal(result.nodeSource, "live");
  assert.equal(result.metricSource, "unavailable");
});

test("uses unavailable markers instead of inventing unmatched metrics", () => {
  const result = mapHomepageCluster({ ...entity, id: 9001, name: "unmatched", config: "not-json", homepageRuntimeCount: null, homepageMetaNodeCount: null }, []);
  assert.equal(result.region, "—");
  assert.equal(result.cpu, null);
  assert.equal(result.runtimes, null);
  assert.equal(result.nodeSource, "unavailable");
  assert.equal(result.metricSource, "unavailable");
});

test("appends copied mock clusters without replacing live rows", () => {
  const result = mergeHomepageClusters([entity], [], [{ id: "copy-1", name: "copy-1", cpu: 0 }]);
  assert.equal(result.live.length, 1);
  assert.equal(result.all.length, 2);
  assert.equal(result.all[1].isMock, true);
});

test("uses backend status until a local simulated operation exists", () => {
  const cluster = mapHomepageCluster(entity);
  assert.deepEqual(resolveHomepageDeployStatus(cluster), { value: "PAUSE_SUCCESS", simulated: false });
  assert.deepEqual(resolveHomepageDeployStatus(cluster, { "cluster:1001": { status: "RESET_SUCCESS" } }), {
    value: "RESET_SUCCESS",
    simulated: true,
  });
});
