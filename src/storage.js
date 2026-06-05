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
