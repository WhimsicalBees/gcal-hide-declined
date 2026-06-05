// Popup uses chrome.storage directly (it can't import ES modules without
// type=module wiring; keep it dependency-free and inline-simple).
// KEY must match HIDE_KEY in storage.js.
const KEY = "hideDeclined";
const toggle = document.getElementById("toggle");

chrome.storage.sync.get([KEY], (res) => {
  toggle.checked = res && res[KEY] === true;
});

toggle.addEventListener("change", () => {
  chrome.storage.sync.set({ [KEY]: toggle.checked });
});
