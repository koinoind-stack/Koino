/**
 * Regression tests — account-status eligibility decision (pure logic).
 *
 * Covers the verified schema values of User.accountStatus
 * (prisma/schema.prisma: "active" | "blocked" | "suspended" | "deactivated")
 * and the fail-closed policy: ONLY the exact string "active" is eligible.
 *
 * Run: npm test
 * (uses the repo's existing tsx devDependency + Node's built-in test runner;
 *  no new dependencies)
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ACCOUNT_STATUS_VALUES,
  isAccountStatusEligible,
} from "@/lib/account-status";

test("AUTH-STATUS-1: the eligible status is exactly the verified schema value 'active'", () => {
  assert.equal(isAccountStatusEligible("active"), true);
});

test("AUTH-STATUS-2: 'suspended', 'blocked' and 'deactivated' are all rejected", () => {
  assert.equal(isAccountStatusEligible("suspended"), false);
  assert.equal(isAccountStatusEligible("blocked"), false);
  assert.equal(isAccountStatusEligible("deactivated"), false);
});

test("AUTH-STATUS-3: missing or corrupt status data is rejected fail-closed", () => {
  assert.equal(isAccountStatusEligible(null), false);
  assert.equal(isAccountStatusEligible(undefined), false);
  assert.equal(isAccountStatusEligible(""), false);
});

test("AUTH-STATUS-4: unknown or wrong-case values are rejected fail-closed", () => {
  assert.equal(isAccountStatusEligible("ACTIVE"), false); // exact lowercase match only
  assert.equal(isAccountStatusEligible("Active"), false);
  assert.equal(isAccountStatusEligible("banned"), false);
  assert.equal(isAccountStatusEligible("hacked"), false);
});

test("AUTH-STATUS-5: documented schema value set is exactly the four known statuses", () => {
  assert.deepEqual([...ACCOUNT_STATUS_VALUES].sort(), [
    "active",
    "blocked",
    "deactivated",
    "suspended",
  ]);
});
