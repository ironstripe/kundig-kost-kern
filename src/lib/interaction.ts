import type { FocusEvent, KeyboardEvent } from "react";

/**
 * Kundi Family interaction helpers (Pass 2).
 * Ordinary form dialogs: Ctrl/Cmd+Enter = visible primary CTA, Escape = cancel.
 * Domain decisions (approvals, handover, import commit) never opt in.
 */

type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey?: boolean; shiftKey?: boolean; isComposing?: boolean };

export function isSubmitShortcut(e: KeyLike): boolean {
  return e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey && !e.isComposing;
}

/**
 * Resolves the primary commit for a dialog: the submit button of the form that
 * contains the focus, otherwise the element marked with data-dialog-submit.
 * Returns null when nothing may be triggered (e.g. commit disabled while pending).
 */
export function findDialogCommit(container: HTMLElement, target: Element | null): (() => void) | null {
  const form = target?.closest("form");
  if (form && container.contains(form)) {
    const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (submitter?.disabled) return null;
    return () => form.requestSubmit();
  }
  const marked = container.querySelector<HTMLButtonElement>("[data-dialog-submit]");
  if (marked && !marked.disabled) return () => marked.click();
  return null;
}

/** keydown handler for DialogContent with submitShortcut enabled. */
export function handleDialogSubmitShortcut(e: KeyboardEvent<HTMLElement>) {
  if (!isSubmitShortcut(e.nativeEvent as unknown as KeyLike) || e.defaultPrevented) return;
  const container = e.currentTarget;
  const target = e.target as Element | null;
  // Events bubbling from portaled children (open selects, nested dialogs) are not ours.
  if (!target || !container.contains(target)) return;
  const commit = findDialogCommit(container, target);
  e.preventDefault();
  e.stopPropagation();
  commit?.();
}

/**
 * Atomic value field: Enter commits (via blur, exactly once), Escape restores
 * the persisted value without committing, unchanged values are not written.
 * On failure the typed value stays in the field.
 */
export function atomicInputProps(persisted: string, commit: (raw: string) => Promise<void> | void) {
  let skipNextBlur = false;
  return {
    defaultValue: persisted,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        skipNextBlur = true;
        e.currentTarget.value = persisted;
        e.currentTarget.blur();
      }
    },
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      if (skipNextBlur) {
        skipNextBlur = false;
        return;
      }
      const raw = e.currentTarget.value;
      if (raw.trim() === persisted.trim()) return;
      void commit(raw);
    },
  };
}
