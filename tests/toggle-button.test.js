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
