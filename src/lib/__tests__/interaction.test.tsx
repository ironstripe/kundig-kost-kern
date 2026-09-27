import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { atomicInputProps, findDialogCommit, isSubmitShortcut } from "@/lib/interaction";
import { ScenarioField } from "@/components/scenario/ScenarioInput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const key = (k: string, mod: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) => ({ key: k, ctrlKey: false, metaKey: false, ...mod });

describe("submit shortcut", () => {
  it("only Ctrl/Cmd+Enter counts", () => {
    expect(isSubmitShortcut(key("Enter", { ctrlKey: true }))).toBe(true);
    expect(isSubmitShortcut(key("Enter", { metaKey: true }))).toBe(true);
    expect(isSubmitShortcut(key("Enter"))).toBe(false);
    expect(isSubmitShortcut(key("Escape", { ctrlKey: true }))).toBe(false);
  });

  it("submits the focused form exactly once and respects pending state", () => {
    document.body.innerHTML = `<div id="c"><form><textarea></textarea><button type="submit">Speichern</button></form></div>`;
    const c = document.getElementById("c")!;
    const form = c.querySelector("form")!;
    const onSubmit = vi.fn((e: Event) => e.preventDefault());
    form.addEventListener("submit", onSubmit);
    findDialogCommit(c, c.querySelector("textarea"))?.();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    c.querySelector("button")!.disabled = true;
    expect(findDialogCommit(c, c.querySelector("textarea"))).toBeNull();
  });

  it("never triggers unmarked domain actions (approval / handover)", () => {
    document.body.innerHTML = `<div id="c"><input /><button id="approve">Durchführung freigeben</button></div>`;
    const c = document.getElementById("c")!;
    const approve = vi.fn();
    c.querySelector("#approve")!.addEventListener("click", approve);
    expect(findDialogCommit(c, c.querySelector("input"))).toBeNull();
    expect(approve).not.toHaveBeenCalled();
  });

  it("clicks the marked primary CTA for button-driven dialogs", () => {
    document.body.innerHTML = `<div id="c"><input /><button data-dialog-submit>Speichern</button></div>`;
    const c = document.getElementById("c")!;
    const save = vi.fn();
    c.querySelector("button")!.addEventListener("click", save);
    findDialogCommit(c, c.querySelector("input"))?.();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe("atomic value field", () => {
  const setup = (persisted: string) => {
    const commit = vi.fn();
    const props = atomicInputProps(persisted, commit);
    const input = document.createElement("input");
    input.value = persisted;
    const ev = (k?: string) => ({ key: k, currentTarget: input, preventDefault() {}, stopPropagation() {} }) as never;
    input.blur = () => props.onBlur(ev());
    return { commit, props, input, ev };
  };

  it("Enter commits once", () => {
    const { commit, props, input, ev } = setup("5");
    input.value = "7";
    props.onKeyDown(ev("Enter"));
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith("7");
  });

  it("Escape restores without committing", () => {
    const { commit, props, input, ev } = setup("5");
    input.value = "9";
    props.onKeyDown(ev("Escape"));
    expect(input.value).toBe("5");
    expect(commit).not.toHaveBeenCalled();
  });

  it("unchanged blur does not write", () => {
    const { commit, props, ev } = setup("5");
    props.onBlur(ev());
    expect(commit).not.toHaveBeenCalled();
  });
});

describe("ScenarioField keyboard", () => {
  const mount = () => {
    const onChange = vi.fn();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<ScenarioField label="Preis" value={10} baseline={10} onChange={onChange} />));
    const input = host.querySelector("input")!;
    const type = (v: string) => {
      act(() => input.focus());
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      act(() => {
        setter.call(input, v);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    const press = (k: string) => act(() => void input.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true })));
    return { onChange, input, type, press };
  };

  it("Enter commits exactly once, a later blur does not commit again", () => {
    const { onChange, input, type, press } = mount();
    type("12");
    press("Enter");
    act(() => input.blur());
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(12);
  });

  it("Escape restores and does not commit", () => {
    const { onChange, input, type, press } = mount();
    type("15");
    press("Escape");
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("10");
  });
});
