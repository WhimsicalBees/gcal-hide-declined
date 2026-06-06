# Hide/Show Declined Events — Chrome Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Manifest V3 Chrome extension that adds a toolbar toggle to hide/show declined events on the Google Calendar web page.

**Architecture:** A content script runs on `calendar.google.com`, detects declined events in the rendered DOM via durable signals (strikethrough styling, then `aria-label`), and toggles a single CSS class on the page root to hide/show them. A `MutationObserver` re-applies on re-render. A toolbar popup writes the on/off state to `chrome.storage.sync`; the content script reacts to storage changes live. Detection is isolated in one pure function so a Google DOM change means editing one file.

**Tech Stack:** Vanilla JavaScript (no framework — keeps the extension tiny and dependency-free at runtime), Manifest V3, Vitest + jsdom for unit testing the detection and toggle logic against captured DOM fixtures.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `manifest.json` | MV3 manifest: content script scope, popup, `storage` permission |
| `src/detect.js` | Pure function: given a DOM root, return declined event elements. The one fragile, swappable unit. |
| `src/content.js` | Content script: read storage, apply/remove CSS class, MutationObserver, listen for storage changes |
| `src/hide-declined.css` | One rule: hide declined events when root has the hide class |
| `src/popup.html` | Toolbar popup markup: one toggle |
| `src/popup.js` | Popup logic: read/write `chrome.storage.sync` |
| `tests/detect.test.js` | Unit tests for `detect.js` against DOM fixtures |
| `tests/storage.test.js` | Unit tests for the storage-state helper |
| `src/storage.js` | Tiny helper wrapping storage get/set with a safe default |
| `tests/fixtures/*.html` | Captured Google Calendar event HTML (declined / accepted / tentative / all-day) |
| `package.json` | Dev dependencies + test script |

Runtime ships zero dependencies (just the static files); Vitest/jsdom are devDependencies only.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore` (already exists — verify contents)
- Create: `vitest.config.js`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "gcal-hide-declined",
  "version": "0.1.0",
  "description": "Chrome extension to hide/show declined events on Google Calendar",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "jsdom": "^24.0.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.js"],
  },
});
```

- [ ] **Step 3: Verify `.gitignore` contains `node_modules/`**

Run: `grep -q "node_modules" .gitignore && echo OK || echo MISSING`
Expected: `OK`

- [ ] **Step 4: Install dev dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.js package-lock.json
git commit -m "chore: scaffold extension project with vitest"
```

---

## Task 2: Capture live DOM fixtures (manual, with the user)

This task produces ground truth. **Do not write detection code before completing it.** The fixtures captured here are what `detect.js` is tested against.

**Files:**
- Create: `tests/fixtures/declined.html`
- Create: `tests/fixtures/accepted.html`
- Create: `tests/fixtures/tentative.html`
- Create: `tests/fixtures/allday-declined.html`
- Create: `tests/fixtures/README.md`

- [ ] **Step 1: Ask the user to capture HTML**

Ask the user to, in Chrome on `calendar.google.com` (Week view, with at least one declined event and one accepted event visible):
1. Right-click a **declined** event chip → Inspect.
2. In DevTools, right-click the highlighted event element → **Copy → Copy outerHTML**.
3. Paste it back to us.
4. Repeat for an **accepted** event, a **tentative** event (if any), and an **all-day declined** event (if any).

- [ ] **Step 2: Save each capture as a fixture file**

Save each pasted blob verbatim into the matching `tests/fixtures/*.html` file. If tentative or all-day examples are unavailable, note their absence in `tests/fixtures/README.md` and skip those test cases (do not fabricate them).

- [ ] **Step 3: Document observed signals in `tests/fixtures/README.md`**

Record concretely, from the captured HTML: how does the declined event differ from the accepted one? Look for and write down (a) inline `text-decoration: line-through` or a `<s>`/`<del>` element on the title, (b) any `aria-label` text mentioning declined/responded status. This written analysis drives the exact selectors in Task 3.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/
git commit -m "test: capture Google Calendar event DOM fixtures"
```

---

## Task 3: Detection function (TDD against fixtures)

**Files:**
- Create: `src/detect.js`
- Test: `tests/detect.test.js`

> **Checkpoint:** The selectors below encode our expected signals (strikethrough primary, `aria-label` backstop). After Task 2, reconcile them with the `README.md` analysis. If the real HTML marks declined events differently, update the constants in `detect.js` and the fixture-loading in the test — the test structure stays the same.

- [ ] **Step 1: Write the failing test**

```js
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/detect.test.js`
Expected: FAIL — `findDeclinedEvents is not a function` / module not found.

- [ ] **Step 3: Write minimal implementation**

> **Signal confirmed by Task 2 capture:** The current Google Calendar DOM has
> **no strikethrough** on declined events (the original design assumption was
> wrong). The durable signal is the screen-reader text in `div.XuJrye`, a
> comma-delimited string whose RSVP status is its own field
> (`..., Sample User, Declined, No location, ...` vs `..., Accepted, ...`).
> We match `Declined` as a delimited token — NOT a loose substring — because
> event titles can contain commas and arbitrary words (one real accepted event's
> title is a long comma-laden string with a URL).

```js
// src/detect.js
// Detect declined events in a rendered Google Calendar DOM subtree.
// This is the single fragile unit. If Google changes its markup, the
// constants/queries here are the only thing that should need editing.

// The accessibility/screen-reader label for an event chip lives in this
// descendant. It is a comma-delimited string that includes the RSVP status
// as a discrete field.
const LABEL_SELECTOR = "div.XuJrye";

// Event chip roots in the rendered grid.
const EVENT_SELECTOR = '[data-eventid][role="button"]';

// Match "Declined" only when it stands alone as a comma-delimited field,
// e.g. ", Declined," — so titles containing the word "declined" don't match.
// Anchored with start/comma on the left and comma/end on the right, tolerant
// of surrounding whitespace (incl. non-breaking spaces).
const DECLINED_FIELD = /(^|,)\s*Declined\s*(,|$)/;

function labelText(eventEl) {
  const label = eventEl.querySelector(LABEL_SELECTOR);
  return label ? label.textContent : "";
}

// Returns true if this event chip's accessibility label marks it declined.
function isDeclined(eventEl) {
  return DECLINED_FIELD.test(labelText(eventEl));
}

// Find all declined event chip elements under `root`.
// Fail-safe: returns [] for a missing/invalid root or when nothing matches.
export function findDeclinedEvents(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];
  const events = root.querySelectorAll(EVENT_SELECTOR);
  const declined = [];
  events.forEach((el) => {
    if (isDeclined(el)) declined.push(el);
  });
  return declined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/detect.test.js`
Expected: PASS (3 tests). The declined fixture's `.XuJrye` text contains
`, Declined,` (matches); the accepted fixture contains `, Accepted,` (no match)
even though its long title has many commas.

- [ ] **Step 5: Commit**

```bash
git add src/detect.js tests/detect.test.js
git commit -m "feat: add declined-event detection with fixture tests"
```

---

## Task 4: Storage helper (TDD)

**Files:**
- Create: `src/storage.js`
- Test: `tests/storage.test.js`

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/storage.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// src/storage.js
export const HIDE_KEY = "hideDeclined";

export function getHideState() {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.get([HIDE_KEY], (res) => {
        resolve(res && res[HIDE_KEY] === true);
      });
    } catch {
      resolve(false); // fail safe: show events
    }
  });
}

export function setHideState(value) {
  return new Promise((resolve) => {
    try {
      chrome.storage.sync.set({ [HIDE_KEY]: value === true }, () => resolve());
    } catch {
      resolve();
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/storage.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/storage.js tests/storage.test.js
git commit -m "feat: add fail-safe storage helper for hide state"
```

---

## Task 5: Stylesheet

**Files:**
- Create: `src/hide-declined.css`

- [ ] **Step 1: Write the stylesheet**

```css
/* When the root carries this class, any element we tagged as declined hides. */
.gce-hide-declined [data-gce-declined="true"] {
  display: none !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hide-declined.css
git commit -m "feat: add hide-declined stylesheet"
```

---

## Task 6: Content script

**Files:**
- Create: `src/content.js`

The content script wires detection + storage + CSS together. It tags declined elements with `data-gce-declined="true"`, toggles the root class from storage, re-tags on DOM mutations (debounced), and reacts to storage changes live.

- [ ] **Step 1: Write the content script**

```js
// src/content.js
import { findDeclinedEvents } from "./detect.js";
import { getHideState, HIDE_KEY } from "./storage.js";

const ROOT_CLASS = "gce-hide-declined";
const TAG_ATTR = "data-gce-declined";

function tagDeclined() {
  // Clear stale tags, then re-tag. Cheap relative to Google's own re-renders.
  document
    .querySelectorAll(`[${TAG_ATTR}="true"]`)
    .forEach((el) => el.removeAttribute(TAG_ATTR));
  const declined = findDeclinedEvents(document.body);
  declined.forEach((el) => el.setAttribute(TAG_ATTR, "true"));
}

function applyHideState(hide) {
  document.documentElement.classList.toggle(ROOT_CLASS, hide === true);
}

let scheduled = false;
function scheduleRetag() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    tagDeclined();
  });
}

async function init() {
  tagDeclined();
  applyHideState(await getHideState());

  // Re-tag when Google re-renders the grid (view/date changes, lazy loads).
  const observer = new MutationObserver(scheduleRetag);
  observer.observe(document.body, { childList: true, subtree: true });

  // React to popup toggling without a page reload.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[HIDE_KEY]) {
      applyHideState(changes[HIDE_KEY].newValue === true);
    }
  });
}

init();
```

- [ ] **Step 2: Sanity-check it parses**

Run: `node --check src/content.js`
Expected: no output (exit 0). (Note: this only checks syntax; `chrome.*` and the imports run in-browser. Functional verification is Task 9.)

- [ ] **Step 3: Commit**

```bash
git add src/content.js
git commit -m "feat: add content script wiring detection, storage, and observer"
```

---

## Task 7: Popup UI

**Files:**
- Create: `src/popup.html`
- Create: `src/popup.js`

- [ ] **Step 1: Write `src/popup.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font: 13px system-ui, sans-serif; margin: 0; padding: 12px 14px; width: 220px; }
      .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
      label { user-select: none; }
    </style>
  </head>
  <body>
    <div class="row">
      <label for="toggle">Hide declined events</label>
      <input type="checkbox" id="toggle" />
    </div>
    <script src="popup.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `src/popup.js`**

```js
// Popup uses chrome.storage directly (it can't import ES modules without
// type=module wiring; keep it dependency-free and inline-simple).
const KEY = "hideDeclined";
const toggle = document.getElementById("toggle");

chrome.storage.sync.get([KEY], (res) => {
  toggle.checked = res && res[KEY] === true;
});

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ [KEY]: toggle.checked });
});
```

- [ ] **Step 3: Commit**

```bash
git add src/popup.html src/popup.js
git commit -m "feat: add toolbar popup toggle"
```

---

## Task 8: Manifest

**Files:**
- Create: `manifest.json`

> **Correction (discovered during implementation):** MV3 manifest-declared
> content scripts do **not** support static `import` — there is no
> `"type": "module"` key for `content_scripts` entries (that key only applies
> to the background service worker). The original plan was wrong here. The fix:
> `content.js` uses **dynamic `import()`** via `chrome.runtime.getURL(...)`, and
> `detect.js`/`storage.js` are exposed in `web_accessible_resources` so the
> module loader can fetch them. `detect.js` and `storage.js` are unchanged
> (their tests still pass); only `content.js` and this manifest differ from the
> originally-drafted code. The manifest below is the corrected version — note
> the absence of `"type": "module"`.

- [ ] **Step 1: Write `manifest.json`**

```json
{
  "manifest_version": 3,
  "name": "Hide Declined Events for Google Calendar",
  "version": "0.1.0",
  "description": "Toggle to hide or show declined events on Google Calendar.",
  "permissions": ["storage"],
  "action": {
    "default_title": "Hide declined events",
    "default_popup": "src/popup.html"
  },
  "content_scripts": [
    {
      "matches": ["https://calendar.google.com/*"],
      "js": ["src/content.js"],
      "css": ["src/hide-declined.css"],
      "run_at": "document_idle"
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["src/detect.js", "src/storage.js"],
      "matches": ["https://calendar.google.com/*"]
    }
  ]
}
```

- [ ] **Step 2: Validate JSON**

Run: `node --check manifest.json 2>/dev/null || python3 -c "import json;json.load(open('manifest.json'));print('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add manifest.json
git commit -m "feat: add MV3 manifest"
```

---

## Task 9: Load and verify end-to-end (manual, with the user)

**Files:** none (verification only)

- [ ] **Step 1: Load the unpacked extension**

Ask the user to: open `chrome://extensions`, enable Developer mode, click "Load unpacked", select the project root.
Expected: extension appears with no errors. If "Service worker / module" errors appear, capture the exact text.

- [ ] **Step 2: Verify default state (shown)**

Open `calendar.google.com`. Declined events should be **visible** (default off).

- [ ] **Step 3: Verify toggle hides**

Click the extension icon, check "Hide declined events". Declined events disappear immediately, no reload.

- [ ] **Step 4: Verify persistence + re-render**

Reload the page → declined stay hidden. Switch Week → Month → Day and navigate dates → declined stay hidden in every view (confirms the MutationObserver re-tagging).

- [ ] **Step 5: Verify toggle shows**

Uncheck the toggle → declined events reappear immediately.

- [ ] **Step 6: If any step fails**

Capture: which step, what happened, and (for detection failures) re-capture the offending event's outerHTML. Feed back into Task 3's `detect.js` constants and fixtures. This is the expected maintenance loop, not a surprise.

- [ ] **Step 7: Commit any fixes, then tag the milestone**

```bash
git add -A
git commit -m "fix: reconcile detection with live DOM"  # only if changes were needed
git tag v0.1.0
```

---

## Self-Review

**Spec coverage:**
- Hide/show declined on rendered page, all views → Tasks 3, 6, 9. ✅
- Persist via `chrome.storage.sync` → Tasks 4, 7. ✅
- Default shown on install → Task 4 (default false), verified Task 9 Step 2. ✅
- MV3, content script scoped to calendar.google.com, minimal `storage` permission → Task 8. ✅
- Detection avoids class names; strikethrough primary, aria-label backstop → Task 3. ✅
- Ground-truth DOM capture as first build task → Task 2. ✅
- Fail-safe error handling (show events on failure) → Task 3 (empty array), Task 4 (default false). ✅
- Isolated, swappable detection function → `src/detect.js`, Task 3 checkpoint. ✅
- Unit tests for detection + toggle/storage; manual for observer/live → Tasks 3, 4, 9. ✅
- Out-of-scope items (mobile, other browsers, other statuses) → not present in plan. ✅

**Placeholder scan:** No TBD/TODO. Tentative/all-day fixtures are conditionally captured with explicit "do not fabricate" instruction (Task 2) — a verification gate, not a placeholder. All code steps contain complete code.

**Type consistency:** `findDeclinedEvents(root)` used identically in detect.js, test, and content.js. `getHideState`/`setHideState`/`HIDE_KEY` consistent across storage.js, test, content.js. CSS class `gce-hide-declined` and attr `data-gce-declined` consistent across content.js and hide-declined.css. Storage key string `"hideDeclined"` matches `HIDE_KEY` in storage.js and the inline constant in popup.js (popup is module-free by design — noted in Task 7). ✅
