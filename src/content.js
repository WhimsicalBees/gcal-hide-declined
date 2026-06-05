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
