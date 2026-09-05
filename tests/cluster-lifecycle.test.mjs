import assert from "node:assert/strict";
import test from "node:test";
import { submitClusterLifecycle } from "../src/api/clusterLifecycle.ts";

for (const [action, endpoint, status] of [["pause", "pauseCluster", "PAUSE"], ["resume", "resumeCluster", "RESET"], ["uninstall", "uninstallCluster", "UNINSTALL"]]) {
  test(`${action} submits backend ID and validates persistence receipt`, async () => {
    const client = { post: async (url, body) => {
      assert.equal(url, `/organization/clusterCycleDeploy/${endpoint}`);
      assert.deepEqual(body, { clusterId: "12001", organizationId: 1 });
      return { data: { code: 200, data: { clusterId: 12001, deployStatusType: status, runtimeCount: 2 } } };
    } };
    assert.equal((await submitClusterLifecycle("12001", action, client)).deployStatusType, status);
  });
}
test("rejects mock IDs without sending requests", async () => {
  await assert.rejects(submitClusterLifecycle("prod-eventmesh-east", "pause", { post: () => assert.fail("must not send") }));
});
test("rejects empty, failed, mismatched and completed responses", async () => {
  for (const data of ["", { code: 500, message: "failed" }, { clusterId: 2, deployStatusType: "PAUSE", runtimeCount: 0 }, { clusterId: 1, deployStatusType: "PAUSE_SUCCESS", runtimeCount: 0 }]) {
    await assert.rejects(submitClusterLifecycle("1", "pause", { post: async () => ({ data }) }));
  }
});
test("does not retry ambiguous writes", async () => {
  let calls = 0;
  await assert.rejects(submitClusterLifecycle("1", "pause", { post: async () => { calls++; throw new Error("timeout"); } }));
  assert.equal(calls, 1);
});
