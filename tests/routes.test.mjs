import assert from "node:assert/strict";
import test from "node:test";
import { clusterResourcePath, normalizeClusterView } from "../src/routes.js";

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
  assert.equal(normalizeClusterView("invalid"), "overview");
});
