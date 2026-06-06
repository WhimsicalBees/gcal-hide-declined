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
