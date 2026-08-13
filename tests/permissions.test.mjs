import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS, roleCan, ROLES } from "../src/permissions.js";

test("system administrators have every permission", () => {
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleCan(ROLES.SYSTEM_ADMIN, permission), true);
  }
});

test("organization owners can assign roles but organization administrators cannot", () => {
  assert.equal(roleCan(ROLES.ORGANIZATION_OWNER, PERMISSIONS.ASSIGN_ROLES), true);
  assert.equal(roleCan(ROLES.ORGANIZATION_ADMIN, PERMISSIONS.ASSIGN_ROLES), false);
});

test("organization members are read-only", () => {
  assert.equal(roleCan(ROLES.ORGANIZATION_MEMBER, PERMISSIONS.VIEW_CONSOLE), true);
  assert.equal(roleCan(ROLES.ORGANIZATION_MEMBER, PERMISSIONS.CREATE_CLUSTER), false);
  assert.equal(roleCan(ROLES.ORGANIZATION_MEMBER, PERMISSIONS.MANAGE_CLUSTER), false);
  assert.equal(roleCan(ROLES.ORGANIZATION_MEMBER, PERMISSIONS.VIEW_OPERATIONS), false);
});
