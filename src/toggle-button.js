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
  button.setAttribute("aria-pressed", isOn ? "true" : "false");
  button.textContent = isOn ? LABEL_ON : LABEL_OFF;
}

// Mount the floating toggle button. Idempotent: if a button already exists,
// it is reused and its original click handler (and original onToggle) is kept —
// the onToggle passed on a re-mount call is ignored. Callers that re-assert the
// button should pass the same logical onToggle each time.
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
