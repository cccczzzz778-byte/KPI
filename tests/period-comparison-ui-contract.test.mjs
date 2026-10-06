import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("period comparison patch exposes leadership labels for Dashboard and Monitoring", () => {
  const file = "patch98.mjs";
  assert.equal(fs.existsSync(file), true, "patch98.mjs should exist");
  const source = fs.readFileSync(file, "utf8");
  for (const label of [
    "Joriy hisobot davri",
    "Avvalgi hisobot davri",
    "Yig‘ma o‘rtacha ko‘rsatkich",
    "Dinamika",
  ]) {
    assert.equal(source.includes(label), true, `missing label: ${label}`);
  }
});
