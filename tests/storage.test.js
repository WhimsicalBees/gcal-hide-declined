import { describe, it, expect, beforeEach, vi } from "vitest";
import { getHideState, setHideState, HIDE_KEY } from "../src/storage.js";

function fakeChromeStorage(initial = {}) {
  let store = { ...initial };
  return {
    storage: {
      sync: {
        get: vi.fn((keys, cb) => cb({ ...store })),
        set: vi.fn((obj, cb) => {
          store = { ...store, ...obj };
          if (cb) cb();
        }),
      },
    },
  };
}

describe("storage helper", () => {
  beforeEach(() => {
    globalThis.chrome = fakeChromeStorage();
  });

  it("defaults to false (shown) when unset", async () => {
    await expect(getHideState()).resolves.toBe(false);
  });

  it("round-trips a true value", async () => {
    await setHideState(true);
    await expect(getHideState()).resolves.toBe(true);
  });

  it("defaults to false when chrome is unavailable (fail-safe)", async () => {
    delete globalThis.chrome;
    await expect(getHideState()).resolves.toBe(false);
  });
});
