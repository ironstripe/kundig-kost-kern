import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { atomicInputProps, findDialogCommit, isSubmitShortcut } from "@/lib/interaction";
import { ScenarioField } from "@/components/scenario/ScenarioInput";
import { StartLauncher } from "@/components/start/StartLauncher";
import { Logo } from "@/components/layout/Logo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const key = (k: string, mod: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) => ({ key: k, ctrlKey: false, metaKey: false, ...mod });

async function mountWithRouter(ui: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => <><Outlet />{ui}</> });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
  const startRoute = createRoute({ getParentRoute: () => rootRoute, path: "/start" });
  const overviewRoute = createRoute({ getParentRoute: () => rootRoute, path: "/uebersicht" });
  const menuCardsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/speisekarten" });
  const menusRoute = createRoute({ getParentRoute: () => rootRoute, path: "/menues" });
  const eventsRoute = createRoute({ getParentRoute: () => rootRoute, path: "/events" });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, startRoute, overviewRoute, menuCardsRoute, menusRoute, eventsRoute]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  window.scrollTo = vi.fn();
  await act(async () => {
    await router.load();
    root.render(<RouterProvider router={router} />);
  });
  return { host, root };
}

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
    act(() => root.render(<ScenarioField label="Preis" value={10} baseline={10} overridden={false} kind="chf" onChange={onChange} />));
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

describe("task-first launcher", () => {
  it("shows only two intents before revealing exactly three calculation types", async () => {
    const { host, root } = await mountWithRouter(<StartLauncher />);
    expect(host.textContent).toContain("Kalkulation starten");
    expect(host.textContent).toContain("Analysieren");
    expect(host.textContent).not.toContain("À-la-carte");
    expect(host.querySelector('a[href="/uebersicht"]')).not.toBeNull();

    const launch = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Kalkulation starten"));
    expect(launch).toBeDefined();
    act(() => launch?.click());

    expect(host.textContent).toContain("Was möchtest du kalkulieren?");
    expect(host.querySelectorAll('a[href="/menues"], a[href="/events"]')).toHaveLength(2);
    expect(host.querySelector('a[href="/speisekarten"]')).toBeNull();
    expect(host.textContent).not.toContain("Analysieren");

    const alacarte = host.querySelector('button[aria-label="À-la-carte kalkulieren"]') as HTMLButtonElement;
    act(() => alacarte.click());
    expect(host.textContent).toContain("Wie möchtest du die À-la-carte-Karte erfassen?");
    expect(host.querySelector('a[href="/speisekarten/importieren?from=gerichte"]')).not.toBeNull();
    expect(host.querySelector('a[href="/gerichte"]')).not.toBeNull();
    expect(host.querySelector('a[href="/speisekarten"]')).toBeNull();

    act(() => (host.querySelector('button[aria-label="Zurück zur Kalkulationsart"]') as HTMLButtonElement).click());
    expect(host.textContent).toContain("Was möchtest du kalkulieren?");

    act(() => root.unmount());
    host.remove();
  });

  it("makes the in-app logo a link to the launcher", async () => {
    const { host, root } = await mountWithRouter(<Logo home />);
    const logo = host.querySelector('a[href="/start"]');
    expect(logo?.getAttribute("aria-label")).toBe("KundiCalc Startseite");

    act(() => root.unmount());
    host.remove();
  });
});
