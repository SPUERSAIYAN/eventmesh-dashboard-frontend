import assert from "node:assert/strict";
import test from "node:test";
import { clusterResourcePath, componentClusterConsolePath, normalizeClusterView, storageClusterConsolePath } from "../src/routes.ts";

test("builds readable shareable cluster resource URLs", () => {
  assert.equal(
    clusterResourcePath("prod eventmesh/east", "topology", { node: "cluster-21", q: "rocket mq" }),
    "/clusters/prod%20eventmesh%2Feast/topology?node=cluster-21&q=rocket+mq",
  );
});

test("keeps topology state only on topology URLs", () => {
  const params = new URLSearchParams("mode=tree&node=runtime-22&q=broker&kind=runtime&component=storage&status=healthy&source=share&tab=topology");
  assert.equal(
    clusterResourcePath("prod-eventmesh-east", "overview", params),
    "/clusters/prod-eventmesh-east/overview?source=share",
  );
  assert.equal(
    clusterResourcePath("prod-eventmesh-east", "topology", params),
    "/clusters/prod-eventmesh-east/topology?mode=tree&node=runtime-22&q=broker&kind=runtime&component=storage&status=healthy&source=share",
  );
});

test("builds shareable resource-tree URLs", () => {
  assert.equal(
    clusterResourcePath("prod-eventmesh", "topology", { mode: "tree", kind: "topic", q: "orders", node: "topic-301" }),
    "/clusters/prod-eventmesh/topology?mode=tree&kind=topic&q=orders&node=topic-301",
  );
});

test("normalizes legacy tab links and invalid views", () => {
  assert.equal(normalizeClusterView(undefined, "topology"), "topology");
  assert.equal(normalizeClusterView("topology"), "topology");
  assert.equal(normalizeClusterView("health"), "overview");
  assert.equal(normalizeClusterView("configuration"), "configuration");
  assert.equal(normalizeClusterView("relations"), "relations");
  assert.equal(normalizeClusterView("summary"), "summary");
  assert.equal(normalizeClusterView("runtime"), "runtime");
  assert.equal(normalizeClusterView("meta"), "meta");
  assert.equal(normalizeClusterView("storage"), "storage");
  assert.equal(normalizeClusterView("invalid"), "overview");
});

test("builds nested Kafka and RocketMQ console paths", () => {
  assert.equal(
    storageClusterConsolePath("prod eventmesh", "kafka", "codex-sim-kafka/orders", "topics"),
    "/clusters/prod%20eventmesh/storage/kafka/codex-sim-kafka%2Forders/topics",
  );
  assert.equal(
    storageClusterConsolePath("prod-eventmesh", "rocketmq", "codex-sim-rocketmq-primary", "brokers"),
    "/clusters/prod-eventmesh/storage/rocketmq/codex-sim-rocketmq-primary/brokers",
  );
  assert.equal(
    storageClusterConsolePath("prod-eventmesh", "invalid", "store", "invalid"),
    "/clusters/prod-eventmesh/storage/kafka/store/overview",
  );
});

test("builds nested Runtime and Meta console paths", () => {
  assert.equal(
    componentClusterConsolePath("prod eventmesh", "runtime", "codex-sim-runtime/east", "connections"),
    "/clusters/prod%20eventmesh/runtime/codex-sim-runtime%2Feast/connections",
  );
  assert.equal(
    componentClusterConsolePath("prod-eventmesh", "meta", "codex-sim-meta-primary", "registry"),
    "/clusters/prod-eventmesh/meta/codex-sim-meta-primary/registry",
  );
  assert.equal(
    componentClusterConsolePath("prod-eventmesh", "invalid", "component", "invalid"),
    "/clusters/prod-eventmesh/runtime/component/overview",
  );
});
