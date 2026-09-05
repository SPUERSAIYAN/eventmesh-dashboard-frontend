import test from "node:test";
import assert from "node:assert/strict";
import { applyHomepageLifecycleReceipt, homepageLifecycleFeedback, homepageLifecycleRefetchInterval } from "../src/data/homepageLifecycleFeedback.ts";

test("acknowledgment updates only its cluster immediately without inventing completion", () => {
  const rows = [{id: 1, deployStatusType: "CREATE_SUCCESS"}, {id: 2, deployStatusType: "PAUSE_SUCCESS"}];
  const next = applyHomepageLifecycleReceipt(rows, {clusterId: "1", deployStatusType: "PAUSE"});
  assert.equal(next[0].deployStatusType, "PAUSE");
  assert.equal(next[1], rows[1]);
  assert.equal(rows[0].deployStatusType, "CREATE_SUCCESS");
  assert.equal(homepageLifecycleRefetchInterval(next), 5000);
});
test("supports clusterId-only backend records", () => {
  assert.equal(applyHomepageLifecycleReceipt([{clusterId: 1}], {clusterId: "1", deployStatusType: "RESET"})[0].deployStatusType, "RESET");
});
test("waiting and executing phases remain distinct for all three operations", () => {
  for (const [waiting, executing] of [["PAUSE", "PAUSE_ING"], ["RESET", "RESET_ING"], ["UNINSTALL", "UNINSTALL_ING"]]) {
    assert.match(homepageLifecycleFeedback(waiting).detail, /已入库/);
    assert.match(homepageLifecycleFeedback(executing).detail, /后台执行中/);
    assert.match(homepageLifecycleFeedback(waiting, "en").detail, /awaiting execution/);
  }
});
test("animation and polling stop on confirmed final states, never advance by time", () => {
  for (const state of ["PAUSE_SUCCESS", "RESET_SUCCESS", "UNINSTALL_SUCCESS", "PAUSE_FAIL", "RESET_FAIL", "UNINSTALL_FAIL", "unknown"]) {
    assert.equal(homepageLifecycleFeedback(state), null);
    assert.equal(homepageLifecycleRefetchInterval([{deployStatusType: state}]), false);
  }
  assert.equal(homepageLifecycleRefetchInterval(undefined), false);
});
