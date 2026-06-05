// src/content.js
// Manifest-declared MV3 content scripts cannot use static `import` (there is no
// "type":"module" for content_scripts). We load the detection and storage
// modules dynamically via chrome.runtime.getURL — they are declared in the
// manifest's web_accessible_resources so the module loader can fetch them.

const ROOT_CLASS = "gce-hide-declined";
const TAG_ATTR = "data-gce-declined";

// Bound from the dynamically imported modules in init().
let findDeclinedEvents;
let getHideState;
let HIDE_KEY;

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
  // Dynamic import of extension-internal ES modules (see header note).
  const detect = await import(chrome.runtime.getURL("src/detect.js"));
  const storage = await import(chrome.runtime.getURL("src/storage.js"));
  findDeclinedEvents = detect.findDeclinedEvents;
  getHideState = storage.getHideState;
  HIDE_KEY = storage.HIDE_KEY;

  tagDeclined();

  // Start observing BEFORE the async storage read so mutations during the
  // await gap (Google's SPA may still be settling) aren't missed. The observer
  // and listener live for the page's lifetime; nothing to disconnect.
  const observer = new MutationObserver(scheduleRetag);
  observer.observe(document.body, { childList: true, subtree: true });

  applyHideState(await getHideState());
  // Re-tag once more in case the DOM changed during the await.
  tagDeclined();

  // React to popup toggling without a page reload. `chrome` is always present
  // in an MV3 content script on calendar.google.com.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes[HIDE_KEY]) {
      applyHideState(changes[HIDE_KEY].newValue === true);
    }
  });
}

init();
