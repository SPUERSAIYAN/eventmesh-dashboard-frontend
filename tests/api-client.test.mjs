import assert from "node:assert/strict";
import test from "node:test";
import { apiClient } from "../src/api/client.ts";
import { apiConfig } from "../src/api/config.ts";
import { unwrapPayload } from "../src/api/contracts.ts";

test("uses the dashboard proxy, fixed organization default and pagination header", () => {
  assert.equal(apiClient.defaults.baseURL, "/eventmesh/dashboard");
  assert.equal(apiConfig.organizationId, 1);
  assert.deepEqual(JSON.parse(apiClient.defaults.headers.queryClause), { limitPageNum: 1, limitSize: 200 });
  assert.equal(apiClient.defaults.headers.common.Authorization, undefined);
});

test("unwraps successful envelopes and rejects HTTP-200 business failures", () => {
  assert.deepEqual(unwrapPayload({ code: 200, data: { records: [1, 2] } }), [1, 2]);
  assert.throws(() => unwrapPayload({ code: 500, data: "query failed" }), /query failed/);
});
