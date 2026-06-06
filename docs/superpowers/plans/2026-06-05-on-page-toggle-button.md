# On-Page Toggle Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-visible, on-page toggle button (bottom-right, styled to blend with Google Calendar) that hides/shows declined events, staying in sync with the existing toolbar popup.

**Architecture:** A new isolated `toggle-button.js` module owns the floating button (create, render state, report clicks) and depends only on the DOM. `content.js` dynamically imports it (same pattern as detect/storage), mounts it after init, routes clicks through the existing `applyHideState`/`setHideState`, and re-asserts the button on re-render. `applyHideState` becomes the single place that updates both the CSS class and the button's visual state.

**Tech Stack:** Vanilla JS, MV3, Vitest + jsdom. Builds on the v0.1.0 extension.

---

## File Structure

| File | Change | Responsibility |
|------|--------|---------------|
| `src/toggle-button.js` | **Create** | Floating button: create element, inject scoped styles, render on/off state, report clicks. DOM-only, no storage/detection. |
| `tests/toggle-button.test.js` | **Create** | Unit tests for the button module (jsdom). |
| `src/content.js` | **Rewrite** | Add button import + mount, route clicks via existing state functions, re-assert button on re-render, make `applyHideState` also drive the button. |
| `manifest.json` | **Modify** | Add `src/toggle-button.js` to `web_accessible_resources`. |

`detect.js`, `storage.js`, `hide-declined.css`, `popup.html`, `popup.js` are unchanged.

---

## Task 1: Toggle button module (TDD)

**Files:**
- Create: `src/toggle-button.js`
- Test: `tests/toggle-button.test.js`

The module exposes `mountToggleButton({ initialOn, onToggle })` returning a handle with `setButtonState(on)` and `element`. The button reads its own state from a `data-on` attribute, flips on click, renders, and calls `onToggle(next)`. Mounting is idempotent (de-dup via `data-gce-toggle`). `setButtonState` updates appearance WITHOUT firing `onToggle`.

- [ ] **Step 1: Write the failing test at `tests/toggle-button.test.js`**

```js
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mountToggleButton } from "../src/toggle-button.js";

const SEL = "[data-gce-toggle]";

describe("mountToggleButton", () => {
  beforeEach(() => {
    document.head.replaceChildren();
    document.body.replaceChildren();
  });

  it("injects exactly one button in the off state with the Hide label", () => {
    mountToggleButton({ initialOn: false, onToggle: () => {} });
    const buttons = document.querySelectorAll(SEL);
    expect(buttons.length).toBe(1);
    expect(buttons[0].getAttribute("data-on")).toBe("false");
    expect(buttons[0].textContent).toBe("Hide declined");
  });

  it("renders the on state with the Show label when initialOn is true", () => {
    mountToggleButton({ initialOn: true, onToggle: () => {} });
    const btn = document.querySelector(SEL);
    expect(btn.getAttribute("data-on")).toBe("true");
    expect(btn.textContent).toBe("Show declined");
  });

  it("flips state and calls onToggle with the new value on click", () => {
    const onToggle = vi.fn();
    mountToggleButton({ initialOn: false, onToggle });
    const btn = document.querySelector(SEL);
    btn.click();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(true);
    expect(btn.getAttribute("data-on")).toBe("true");
    expect(btn.textContent).toBe("Show declined");
  });

  it("setButtonState updates appearance without firing onToggle", () => {
    const onToggle = vi.fn();
    const handle = mountToggleButton({ initialOn: false, onToggle });
    handle.setButtonState(true);
    const btn = document.querySelector(SEL);
    expect(btn.getAttribute("data-on")).toBe("true");
    expect(btn.textContent).toBe("Show declined");
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("does not create a duplicate button when mounted twice", () => {
    mountToggleButton({ initialOn: false, onToggle: () => {} });
    mountToggleButton({ initialOn: false, onToggle: () => {} });
    expect(document.querySelectorAll(SEL).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/toggle-button.test.js`
Expected: FAIL — module not found / `mountToggleButton is not a function`.

- [ ] **Step 3: Write the implementation at `src/toggle-button.js`**

```js
// src/toggle-button.js
// Floating on-page toggle button for hide/show declined events.
// DOM-only: no storage, no detection. content.js wires it to state.

const BUTTON_ATTR = "data-gce-toggle";
const STYLE_ID = "gce-toggle-style";

// Label says what a click will DO; color (data-on) says the current state.
const LABEL_ON = "Show declined"; // on  = events currently hidden
const LABEL_OFF = "Hide declined"; // off = events currently shown

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  // Scoped entirely via the [data-gce-toggle] attribute so Google's CSS
  // can't bleed in and ours can't leak out.
  style.textContent = `
    [${BUTTON_ATTR}] {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      font: 500 14px "Google Sans", Roboto, system-ui, sans-serif;
      padding: 10px 16px; border-radius: 9999px; cursor: pointer;
      border: 1px solid #dadce0; background: #fff; color: #3c4043;
      box-shadow: 0 1px 3px rgba(60,64,67,0.3);
    }
    [${BUTTON_ATTR}]:hover { background: #f8f9fa; }
    [${BUTTON_ATTR}]:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
    [${BUTTON_ATTR}][data-on="true"] {
      background: #1a73e8; color: #fff; border-color: #1a73e8;
    }
    [${BUTTON_ATTR}][data-on="true"]:hover { background: #1765cc; }
  `;
  (document.head || document.documentElement).appendChild(style);
}

function render(button, on) {
  const isOn = on === true;
  button.setAttribute("data-on", isOn ? "true" : "false");
  button.textContent = isOn ? LABEL_ON : LABEL_OFF;
}

export function mountToggleButton({ initialOn, onToggle }) {
  injectStyle();
  let button = document.querySelector(`[${BUTTON_ATTR}]`);
  if (!button) {
    button = document.createElement("button");
    button.setAttribute(BUTTON_ATTR, "");
    button.type = "button";
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-on") !== "true";
      render(button, next);
      onToggle(next);
    });
    (document.body || document.documentElement).appendChild(button);
  }
  render(button, initialOn);
  return {
    setButtonState(on) {
      render(button, on);
    },
    element: button,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/toggle-button.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/toggle-button.js tests/toggle-button.test.js
git commit -m "feat: add floating on-page toggle button module"
```

---

## Task 2: Wire button into content script + manifest

**Files:**
- Rewrite: `src/content.js`
- Modify: `manifest.json`

This rewrites `content.js` to import and mount the button, route its clicks through the existing state functions, re-assert it on re-render, and make `applyHideState` the single place that updates both the CSS class and the button. It also binds `setHideState` (previously unused) from the storage module.

- [ ] **Step 1: Replace the entire contents of `src/content.js` with:**

```js
// src/content.js
// Manifest-declared MV3 content scripts cannot use static `import` (there is no
// "type":"module" for content_scripts). We load the detection, storage, and
// toggle-button modules dynamically via chrome.runtime.getURL — they are
// declared in the manifest's web_accessible_resources so the loader can fetch
// them.

const ROOT_CLASS = "gce-hide-declined";
const TAG_ATTR = "data-gce-declined";

// Bound from the dynamically imported modules in init().
let findDeclinedEvents;
let getHideState;
let setHideState;
let HIDE_KEY;
let mountToggleButton;

// Current hide state, kept in one place. The button handle (once mounted) is
// updated whenever this changes.
let currentHide = false;
let buttonHandle = null;

function tagDeclined() {
  // Clear stale tags, then re-tag. Cheap relative to Google's own re-renders.
  document
    .querySelectorAll(`[${TAG_ATTR}="true"]`)
    .forEach((el) => el.removeAttribute(TAG_ATTR));
  const declined = findDeclinedEvents(document.body);
  declined.forEach((el) => el.setAttribute(TAG_ATTR, "true"));
}

// Single source of truth for applying state: updates the CSS class AND the
// button (if mounted). Everything that changes state calls this.
function applyHideState(hide) {
  currentHide = hide === true;
  document.documentElement.classList.toggle(ROOT_CLASS, currentHide);
  if (buttonHandle) buttonHandle.setButtonState(currentHide);
}

// Mount (or re-mount) the button. Idempotent — safe to call repeatedly. Mounts
// with the current known state and routes clicks through applyHideState +
// setHideState. Wrapped so a button failure can never break the hide logic.
function ensureButton() {
  if (!mountToggleButton) return;
  try {
    buttonHandle = mountToggleButton({
      initialOn: currentHide,
      onToggle: (next) => {
        applyHideState(next);
        setHideState(next);
      },
    });
  } catch (e) {
    console.warn("[gce] toggle button mount failed", e);
  }
}

let scheduled = false;
function scheduleRetag() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    tagDeclined();
    ensureButton(); // re-assert if Google's re-render removed our node
  });
}

async function init() {
  // Dynamic import of extension-internal ES modules (see header note).
  const detect = await import(chrome.runtime.getURL("src/detect.js"));
  const storage = await import(chrome.runtime.getURL("src/storage.js"));
  const toggle = await import(chrome.runtime.getURL("src/toggle-button.js"));
  findDeclinedEvents = detect.findDeclinedEvents;
  getHideState = storage.getHideState;
  setHideState = storage.setHideState;
  HIDE_KEY = storage.HIDE_KEY;
  mountToggleButton = toggle.mountToggleButton;

  tagDeclined();

  // Start observing BEFORE the async storage read so mutations during the
  // await gap (Google's SPA may still be settling) aren't missed. The observer
  // and listener live for the page's lifetime; nothing to disconnect.
  const observer = new MutationObserver(scheduleRetag);
  observer.observe(document.body, { childList: true, subtree: true });

  applyHideState(await getHideState()); // sets currentHide
  tagDeclined(); // re-tag in case the DOM changed during the await
  ensureButton(); // mount the button with the correct initial state

  // React to changes from the popup (or another tab) without a page reload.
  // `chrome` is always present in an MV3 content script on calendar.google.com.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[HIDE_KEY]) {
      applyHideState(changes[HIDE_KEY].newValue === true);
    }
  });
}

init();
```

- [ ] **Step 2: Syntax-check content.js**

Run: `node --input-type=module --check < src/content.js`
Expected: no output, exit 0.

- [ ] **Step 3: Add `src/toggle-button.js` to `web_accessible_resources` in `manifest.json`**

Replace the `web_accessible_resources` block so its `resources` array includes the new module:

```json
  "web_accessible_resources": [
    {
      "resources": ["src/detect.js", "src/storage.js", "src/toggle-button.js"],
      "matches": ["https://calendar.google.com/*"]
    }
  ]
```

- [ ] **Step 4: Validate the manifest JSON**

Run: `python3 -c "import json;json.load(open('manifest.json'));print('valid')"`
Expected: `valid`

- [ ] **Step 5: Run the full test suite (confirm nothing regressed)**

Run: `npm test`
Expected: PASS — all test files (detect, storage, toggle-button) green.

- [ ] **Step 6: Commit**

```bash
git add src/content.js manifest.json
git commit -m "feat: wire on-page toggle button into content script"
```

---

## Task 3: Load and verify end-to-end (manual, with the user)

**Files:** none (verification only)

- [ ] **Step 1: Reload the extension**

Ask the user to open `chrome://extensions` and click the reload icon on
"Hide Declined Events for Google Calendar" (or Load unpacked from the project
root if not already loaded). Then open/reload `calendar.google.com`.
Expected: no errors. If the extensions page shows a red "Errors" button, capture
the text.

- [ ] **Step 2: Verify the button appears**

A pill button labeled **"Hide declined"** appears at the bottom-right of the
calendar page, styled to blend in (white pill, subtle shadow).

- [ ] **Step 3: Verify clicking hides**

Click the button. Declined events disappear immediately. The button turns blue
and its label changes to **"Show declined"**.

- [ ] **Step 4: Verify persistence + re-render**

Reload the page → declined stay hidden, button still blue/"Show declined".
Switch Week → Month → Day and navigate dates → the button stays put in every
view and declined stay hidden (confirms the re-assert + observer).

- [ ] **Step 5: Verify popup ↔ button sync**

Open the Chrome toolbar popup. Its checkbox should reflect the current state
(checked). Toggle it off in the popup → on the page, declined reappear AND the
button returns to white/"Hide declined" without a reload. Toggle the on-page
button → reopen the popup → its checkbox matches.

- [ ] **Step 6: Verify clicking shows**

With events hidden, click the on-page button → declined reappear immediately,
button returns to white/"Hide declined".

- [ ] **Step 7: If any step fails**

Capture which step, what happened, and any console errors (DevTools console on
the calendar page). For button-not-appearing, confirm `src/toggle-button.js` is
in `web_accessible_resources`. Report back for a fix.

- [ ] **Step 8: Tag the release**

```bash
git tag v0.2.0
```

---

## Self-Review

**Spec coverage:**
- Floating button, bottom-right, blends in → Task 1 (styles), Task 3 Step 2. ✅
- Click toggles hide/show instantly + persists → Task 2 (`onToggle` → `applyHideState` + `setHideState`), Task 3 Steps 3/6. ✅
- Button visual state reflects setting, updates live from popup → Task 2 (`applyHideState` drives `setButtonState`; `onChanged` calls `applyHideState`), Task 3 Step 5. ✅
- Survives re-renders → Task 2 (`ensureButton` in `scheduleRetag`), Task 3 Step 4. ✅
- Popup retained as secondary control → unchanged `popup.*`; sync via shared storage, Task 3 Step 5. ✅
- New isolated `toggle-button.js`, DOM-only, testable → Task 1. ✅
- Manifest adds module to `web_accessible_resources` → Task 2 Step 3. ✅
- `setHideState` (was unused) now has a caller → Task 2 (`onToggle`). ✅
- Fail-safe: button failure can't break hide logic → Task 2 (`ensureButton` try/catch). ✅
- Idempotent mount / no duplicates → Task 1 (de-dup by attribute, tested). ✅
- Out of scope (drag, reposition, remove popup, Shadow DOM) → not present. ✅

**Placeholder scan:** No TBD/TODO. All code blocks complete; all commands have expected output.

**Type consistency:**
- `mountToggleButton({ initialOn, onToggle })` → returns `{ setButtonState, element }`: defined in Task 1, consumed identically in Task 2 (`buttonHandle.setButtonState`, `initialOn: currentHide`, `onToggle: (next) => ...`).
- `data-gce-toggle` attribute + `data-on` state + labels "Hide declined"/"Show declined": consistent across Task 1 implementation, Task 1 tests, and Task 3 manual checks.
- Storage names `getHideState`/`setHideState`/`HIDE_KEY` match the existing `storage.js` exports. `applyHideState`/`tagDeclined`/`scheduleRetag`/`ensureButton` consistent within the Task 2 file. ✅
