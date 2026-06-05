# Hide/Show Declined Events — Chrome Extension Design

**Date:** 2026-06-04
**Status:** Approved design, pending spec review

## Summary

A Manifest V3 Chrome extension that adds a toggle to hide/show declined events
directly on the Google Calendar web page (`calendar.google.com`). It operates
purely on the already-rendered page — no backend, no OAuth, no Google API calls.

This approach was chosen over building a custom calendar frontend because the
single desired feature (hide/show declined events) is perfectly suited to a
content-script overlay, and running inside Google Calendar means the rest of the
UI — especially the "find a time" / scheduling experience — is Google's own and
needs no rebuilding.

## Scope

**In scope (v1):**
- A toolbar popup with one toggle: hide/show declined events.
- Hiding declined events on the rendered Calendar page across all views
  (month, week, day) and date navigation.
- Toggle state persisted across page loads and sessions via
  `chrome.storage.sync` (follows the user's Chrome profile).
- Default on first install: declined events **shown** (user opts into hiding).

**Out of scope (v1) — YAGNI:**
- Mobile (Chrome extensions are desktop-web only).
- Other browsers (Firefox, Safari).
- Other Google surfaces (Gmail event cards, etc.).
- Hiding by any status other than declined (tentative, etc.).
- Any options/settings page beyond the single toggle.

## Architecture & Components

Four small pieces, each with a single responsibility:

1. **`manifest.json`** — Manifest V3. Declares:
   - A content script scoped to `https://calendar.google.com/*`.
   - A toolbar popup.
   - The `storage` permission.
   - No `tabs`, no broad host permissions — minimal by design.

2. **Content script (`content.js`)** — the engine:
   - Detects declined events in the rendered DOM (see Detection Strategy).
   - Applies/removes a single CSS class (e.g. `gce-hide-declined`) on a root
     element.
   - Uses a `MutationObserver` to re-apply when Google re-renders (view
     switches, date navigation — the grid redraws constantly).
   - Reads initial state from storage on load.
   - Listens for storage changes and reacts live (no page reload).

3. **Stylesheet (`hide-declined.css`)** — injected with the content script.
   One rule: when the root has the hide class, declined events get
   `display: none`. Keeping hiding in CSS (not per-element JS) makes toggling
   instant and cheap to survive re-renders.

4. **Popup (`popup.html` + `popup.js`)** — a tiny toolbar UI with one toggle
   switch. Writes state to `chrome.storage.sync`.

### Data flow

```
Popup toggle
  → chrome.storage.sync
  → storage change event
  → content script adds/removes CSS class on root
  → declined events hide/show instantly
```

### Isolation rationale

Detection (content script) is the fragile part that may need maintenance when
Google changes their DOM. The toggle/storage/popup parts are stable and
independent of Google. This separation is deliberate: when Google breaks
something, the failure is localized to one file (detection), and the detection
rule is an isolated, swappable function.

## Detection Strategy (the fragile part)

Google's DOM uses randomized, obfuscated class names that change without
warning. Detection therefore must **not** key off CSS class names. Layered
strategy, most-durable to least:

1. **Primary — visual strikethrough.** Google renders declined events with the
   title struck through (`text-decoration: line-through`). This is a semantic
   rendering choice tied to meaning, more stable across redesigns than class
   names. Find event elements whose title has line-through styling; tag their
   container.

2. **Backstop — `aria-label` text.** Calendar event elements carry rich
   `aria-label`s for accessibility. Accessibility attributes change far less
   often than visual markup (Google has strong incentives not to break screen
   readers). If the label exposes declined status, that's a durable secondary
   signal.

3. **Resilience.** If detection finds zero declined events across a populated
   calendar, treat it as a likely signal that Google changed something. The
   extension fails safe (shows everything) and this is the trigger to update
   detection.

### Ground-truth verification

Detection depends on Google's rendered output, so the **first build task** is to
verify detection signals against the live DOM — open Calendar with a known
declined event, inspect the actual rendered HTML via DevTools, and capture it as
a fixture. The user has confirmed they can provide this. We build on captured
HTML, not assumptions.

## Testing

**Unit-testable (clean):**
- Detection function in isolation — fed captured DOM fixtures (declined event,
  accepted event, tentative event, all-day event). Assert it tags only declined.
- Toggle/storage logic — popup flip writes the right value; storage-change
  events flip the CSS class.

**Manual verification (live page, not unit-testable):**
- `MutationObserver` re-applies hiding after view switches (week → month → day)
  and date navigation.
- Toggle reacts live without page reload.

**TDD note:** TDD applies cleanly to toggle/storage/CSS logic and to the
detection function (via DOM fixtures). The detection rule is structured as one
isolated, swappable function fed by fixtures, so a Google DOM change means
replacing one function and its fixture — nothing else.

## Error Handling

All failure modes fail safe toward "show events":

- Detection finds nothing → show everything (never hide what can't be classified).
- Storage read fails → default to "shown."
- DOM structure unrecognized → no-op, console warning, do not break Calendar.

**Guiding principle:** a broken extension should be invisible, never
destructive. Worst case is "the toggle stopped working," never "my events
disappeared and I missed a meeting."

## Future (not v1)

Architecture stays simple but not painted into a corner. A second tweak later
(another decoration of Google's rendered page) can be added as an additional
detection+CSS pair following the same pattern. Features requiring data Google's
DOM does not expose would require the larger custom-app approach and are out of
scope.
