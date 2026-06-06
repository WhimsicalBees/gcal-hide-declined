# On-Page Toggle Button — Design

**Date:** 2026-06-05
**Status:** Approved design, pending spec review
**Builds on:** `2026-06-04-hide-declined-events-extension-design.md` (v0.1.0)

## Summary

Add a floating, on-page toggle button to the existing Hide Declined Events
extension. The button is pinned to the **bottom-right** of the Google Calendar
page, styled to blend with Google's UI, and controls the same hide/show-declined
state as the existing Chrome toolbar popup. Both controls read and write the
same `chrome.storage.sync` key, so they stay in sync automatically.

This removes the friction of opening the toolbar popup every time: the toggle is
always visible on the page.

## Goal

A persistent on-page button so the user never has to open the toolbar popup to
hide/show declined events.

## Scope

**In scope:**
- A button drawn by the content script onto the page, pinned bottom-right,
  always visible, surviving Google's re-renders.
- Clicking it toggles hide/show declined instantly and persists the state.
- The button's visual state reflects the current setting and updates live when
  the state is changed elsewhere (e.g. the popup).
- The Chrome toolbar popup is retained as a secondary control.

**Out of scope (YAGNI):**
- Dragging / repositioning the button or a setting for its location.
- Animations beyond a simple state change.
- Removing the popup.
- Shadow DOM isolation (overkill for a single button; tight attribute-scoped
  styles suffice).

## Architecture & Components

The existing v0.1.0 components are unchanged except for `content.js`. One new
file is added.

### New — `src/toggle-button.js`

Owns the floating button. Single responsibility: create the button element,
keep its visual state in sync, report clicks. Depends only on the DOM (no
storage, no detection) so it is unit-testable in jsdom.

Interface:
- `mountToggleButton({ initialOn, onToggle })` — injects the button into the
  page, sets its initial visual state from `initialOn` (boolean), and calls
  `onToggle(newValue)` when clicked (where `newValue` is the flipped boolean).
  Idempotent: mounting when a button already exists does not create a duplicate
  (de-duplicated via the `data-gce-toggle` attribute). Returns a handle.
- The returned handle exposes `setButtonState(on)` — updates the button's
  appearance/label to match `on` without firing `onToggle`. Used when the state
  changes elsewhere (popup).

### Extended — `src/content.js`

The orchestrator already owns storage and hide logic. Additions:
- After init, dynamically import `toggle-button.js` (same
  `chrome.runtime.getURL` pattern as `detect.js`/`storage.js`) and call
  `mountToggleButton` with `initialOn` from `getHideState()` and an `onToggle`
  callback that calls `setHideState(newValue)` and `applyHideState(newValue)`.
- Keep a reference to the returned handle. In the existing
  `chrome.storage.onChanged` listener, also call `handle.setButtonState(...)` so
  popup-driven changes update the button.
- In the MutationObserver path, re-assert the button: if Google's re-render
  removed our node, re-mount it. The mount is idempotent, so this is a safe
  cheap guard. Wrapped so a failure cannot break the existing hide logic.

### Manifest

Add `src/toggle-button.js` to `web_accessible_resources` (it is dynamically
imported, like `detect.js` and `storage.js`).

### Reused unchanged

`detect.js`, `storage.js`, `hide-declined.css`, `popup.html`, `popup.js`.
`setHideState` (exported in v0.1.0 but previously unused) now has a caller.

## Button Styling & State

Positioned `position: fixed; bottom: 24px; right: 24px;` with a high `z-index`
so it stays above the grid.

Blend with Google Calendar:
- Font stack `"Google Sans", Roboto, system-ui, sans-serif`.
- Pill shape, subtle shadow, matching the look of Google's secondary buttons.
- A hover shade and a visible focus ring (keyboard accessibility).

State mapping (label says what a click will DO; color says what state you are
IN):
- **Off** (events shown): white background, grey text, label **"Hide declined"**.
- **On** (events hidden): Google-blue background (`#1a73e8`), white text, label
  **"Show declined"**.

Styles are applied so they do not depend on Google's CSS classes and do not
meaningfully leak: the button carries a unique `data-gce-toggle` attribute and
all rules are scoped via that attribute. Styles are injected via a dedicated
`<style>` block (or set inline on the element).

## Data Flow

```
Click on-page button
  → onToggle(newValue)
  → setHideState(newValue)  [persist to chrome.storage.sync]
  → applyHideState(newValue) [toggle CSS class on <html>, hides/shows instantly]

Popup toggle
  → chrome.storage.sync write
  → content.js storage.onChanged listener
  → applyHideState(newValue) AND handle.setButtonState(newValue)
  → on-page button updates to match
```

## Error Handling

Same fail-safe spirit as v0.1.0 (failures default to events shown, never break
the page):
- If button injection throws, swallow and log a console warning. The popup still
  works; events default to shown.
- The MutationObserver re-assert is wrapped so a failure there cannot break the
  existing hide logic.

## Testing

**Unit-testable (jsdom), `tests/toggle-button.test.js`:**
- `mountToggleButton({ initialOn: false, onToggle })` injects exactly one button
  with the "Hide declined" label and off-state.
- `initialOn: true` renders the "Show declined" label and on-state.
- Clicking the button calls `onToggle` with the flipped boolean.
- `setButtonState(on)` updates label/appearance and does NOT fire `onToggle`.
- Mounting twice results in exactly one button (de-dup by `data-gce-toggle`).

**Manual verification (live page):**
- Button appears bottom-right on `calendar.google.com`.
- Click hides/shows declined events instantly.
- State survives view switches (week/month/day) and page reload.
- Popup and on-page button stay in sync (toggling one updates the other).

## Future (not this spec)

Consistent with the parent extension: further on-page controls would follow the
same mount/handle pattern. Repositioning or theming options remain out of scope
until there is a concrete need.
