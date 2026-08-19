import assert from "node:assert/strict";
import test from "node:test";
import {
  addClusterRelations,
  defaultMockRelationState,
  inheritClusterRelations,
  normalizeMockRelationState,
  removeClusterRelation,
} from "../src/mockClusterRelations.ts";

test("falls back to seeded versioned relation state", () => {
  const fallback = normalizeMockRelationState({ version: 0, relations: [] });
  assert.equal(fallback.version, 1);
  assert.ok(fallback.relations.length > 0);
});

test("adds relations without creating duplicates", () => {
  const state = defaultMockRelationState();
  const componentId = "codex-sim-runtime-edge";
  const once = addClusterRelations(state, "prod-eventmesh-east", [componentId], "2026-08-19T10:00:00+08:00");
  const twice = addClusterRelations(once, "prod-eventmesh-east", [componentId], "2026-08-19T10:01:00+08:00");
  assert.equal(twice.relations.filter((item) => item.eventMeshClusterId === "prod-eventmesh-east" && item.componentClusterId === componentId).length, 1);
});

test("supports many EventMesh clusters sharing one component", () => {
  const state = addClusterRelations(defaultMockRelationState(), "new-eventmesh", ["codex-sim-runtime-shared"]);
  assert.ok(state.relations.filter((item) => item.componentClusterId === "codex-sim-runtime-shared").length >= 3);
});

test("removes one relation and inherits source relations for copied clusters", () => {
  const state = defaultMockRelationState();
  const source = state.relations.find((item) => item.eventMeshClusterId === "prod-eventmesh-east");
  const removed = removeClusterRelation(state, source.id);
  assert.equal(removed.relations.some((item) => item.id === source.id), false);
  const inherited = inheritClusterRelations(removed, "prod-eventmesh-east", "copied-eventmesh", "2026-08-19T11:00:00+08:00");
  assert.deepEqual(
    inherited.relations.filter((item) => item.eventMeshClusterId === "copied-eventmesh").map((item) => item.componentClusterId).sort(),
    removed.relations.filter((item) => item.eventMeshClusterId === "prod-eventmesh-east").map((item) => item.componentClusterId).sort(),
  );
});
