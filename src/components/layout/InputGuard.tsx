"use client";

import { useEffect } from "react";

// One guard for every field on the site, present and future:
//   * a number field takes digits only (no "e", sign or decimal point);
//   * a phone field takes digits and + ( ) - space;
//   * an email field takes the characters an address can have;
//   * every field gets a length limit when the form did not set its own.
// It refuses the keystroke or paste before it lands, so the value React
// holds never contains anything else. The server and the database check
// again — this is for the person typing, not the defence.
const ALLOWED: Record<string, RegExp> = {
  number: /^[0-9]*$/,
  tel: /^[0-9+ ()-]*$/,
  email: /^[A-Za-z0-9._%+\-@]*$/,
};
const MAX: Record<string, number> = { email: 254, tel: 20, password: 72, search: 100, url: 500, text: 200 };
const MAX_DIGITS = 9;
const MAX_TEXTAREA = 4000;

export default function InputGuard() {
  useEffect(() => {
    const onBeforeInput = (e: InputEvent) => {
      const el = e.target;
      if (!(el instanceof HTMLInputElement) || e.isComposing) return;
      const data = e.data ?? e.dataTransfer?.getData("text/plain") ?? null;
      if (data == null) return; // deleting, moving the caret…
      const rule = ALLOWED[el.type];
      if (rule && !rule.test(data)) return e.preventDefault();
      // Browsers ignore maxlength on number fields.
      if (el.type === "number" && el.value.length + data.length > MAX_DIGITS) e.preventDefault();
    };

    const onFocus = (e: FocusEvent) => {
      const el = e.target;
      if (el instanceof HTMLTextAreaElement) {
        if (el.maxLength < 0) el.maxLength = MAX_TEXTAREA;
      } else if (el instanceof HTMLInputElement && el.maxLength < 0 && MAX[el.type]) {
        el.maxLength = MAX[el.type];
      }
    };

    document.addEventListener("beforeinput", onBeforeInput, true);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("beforeinput", onBeforeInput, true);
      document.removeEventListener("focusin", onFocus);
    };
  }, []);

  return null;
}
