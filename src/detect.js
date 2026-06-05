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
