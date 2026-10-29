import test from "node:test";
import assert from "node:assert/strict";
import { decideChange } from "./health_watch.ts";

test("a changed appointment page produces an alert decision", () => {
  const result = decideChange("Monday: 9:00", "Monday: 10:00");
  assert.equal(result.changed, true);
  assert.equal(result.subject, "Healthtech appointment page changed");
});

test("identical page content does not produce an alert", () => {
  const result = decideChange("Monday: 9:00", " Monday: 9:00 ");
  assert.equal(result.changed, false);
  assert.equal(result.subject, "");
});
