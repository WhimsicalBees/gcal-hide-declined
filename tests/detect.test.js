import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { findDeclinedEvents } from "../src/detect.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) =>
  readFileSync(join(here, "fixtures", name), "utf8");

function mountInto(root, html) {
  root.innerHTML = html;
  return root;
}

describe("findDeclinedEvents", () => {
  let root;
  beforeEach(() => {
    root = document.createElement("div");
    document.body.replaceChildren(root);
  });

  it("tags a declined event", () => {
    mountInto(root, fixture("declined.html"));
    const found = findDeclinedEvents(root);
    expect(found.length).toBe(1);
  });

  it("does not tag an accepted event", () => {
    mountInto(root, fixture("accepted.html"));
    const found = findDeclinedEvents(root);
    expect(found.length).toBe(0);
  });

  it("returns empty array for an empty root (fail-safe)", () => {
    const found = findDeclinedEvents(root);
    expect(Array.isArray(found)).toBe(true);
    expect(found.length).toBe(0);
  });

  it("returns empty array for null/invalid root (fail-safe)", () => {
    expect(findDeclinedEvents(null)).toEqual([]);
    expect(findDeclinedEvents(undefined)).toEqual([]);
    expect(findDeclinedEvents("not an element")).toEqual([]);
  });
});
