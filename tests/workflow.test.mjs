// The update workflow's rules (lib/admin/workflow.ts): what may be approved and published,
// with the unconfirmed steps (approval, rollback) switched on and off.
import { test } from "node:test";
import assert from "node:assert/strict";
import { approveBlocker, awaitingApproval, displayStatus, publishBlocker, workflowSettings } from "../lib/admin/workflow.ts";

const A = { kind: "admin", id: "a", name: "Admin A", email: "a@example.com" };
const B = { kind: "admin", id: "b", name: "Admin B", email: "b@example.com" };
const ok = { passed: true, errors: [], warnings: [] };
const v = (o = {}) => ({ id: "x", version: 2, as_of: "2026-10", status: "draft", source_file: { filename: "f.xlsx", size_bytes: 1, uploaded_at: "" },
  created_at: "", created_by: A, approved_at: null, approved_by: null, published_at: null, published_by: null, validation: ok, changes: null, counts: null, ...o });
const live = { version: 3 };
const OFF = workflowSettings({});
const ON = workflowSettings({ ADMIN_REQUIRE_APPROVAL: "true" });

test("defaults: approval off, rollback on", () => {
  assert.deepEqual(OFF, { approvalRequired: false, rollback: true });
  assert.equal(workflowSettings({ ADMIN_ALLOW_ROLLBACK: "false" }).rollback, false);
});

test("only Live and Final are shown; a failed upload has no status", () => {
  assert.equal(displayStatus({ status: "published" }), "live");
  assert.equal(displayStatus({ status: "draft" }), "final");
  assert.equal(displayStatus({ status: "archived" }), "final");
  assert.equal(displayStatus({ status: "rejected" }), null);
});

test("without approval, a validated Final version can be published", () => {
  assert.equal(publishBlocker(v({ version: 4 }), live, OFF), null);
  assert.equal(approveBlocker(v(), B, OFF), "Approval isn’t required");
});

test("a failed upload or the live version can never be published", () => {
  assert.match(publishBlocker(v({ status: "rejected", version: null, validation: { passed: false, errors: [{ code: "x", message: "x" }], warnings: [] } }), live, OFF), /failed validation/);
  assert.match(publishBlocker(v({ status: "published" }), null, OFF), /already live/);
});

test("with approval required, publishing waits for another administrator's approval", () => {
  const next = v({ version: 4 });
  assert.equal(awaitingApproval(next, ON), true);
  assert.match(publishBlocker(next, live, ON), /approval/);
  assert.match(approveBlocker(next, A, ON), /another administrator/);     // the uploader can't
  assert.equal(approveBlocker(next, B, ON), null);                       // someone else can
  const approved = { ...next, approved_by: B, approved_at: "2026-11-12T00:00:00Z" };
  assert.equal(publishBlocker(approved, live, ON), null);
  assert.equal(approveBlocker(approved, B, ON), "Already approved");
});

test("publishing an earlier version again depends on the rollback setting", () => {
  const earlier = v({ status: "archived", version: 1 });
  assert.equal(publishBlocker(earlier, live, OFF), null);
  assert.match(publishBlocker(earlier, live, workflowSettings({ ADMIN_ALLOW_ROLLBACK: "false" })), /earlier version/);
});
