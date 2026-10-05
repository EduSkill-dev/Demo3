"use client";

// A frozen account may look around but not act. Wrapped around the page, this
// switches off every control (buttons, fields, forms) except the ones marked
// `data-view` — those only show something (open a hike, filter the list,
// expand an answer). Links keep working, so moving between pages does too.
// The look comes from `.frozen` in globals.css; the server refuses the
// actions anyway, this just makes that visible up front.
const CONTROLS = "button, input, select, textarea, [role='button']";

function isFrozenControl(target: EventTarget | null): boolean {
  const el = target instanceof Element ? target.closest(CONTROLS) : null;
  return !!el && !el.closest("[data-view]");
}

export default function FrozenGuard({ active, children }: { active: boolean; children: React.ReactNode }) {
  if (!active) return <>{children}</>;

  const stop = (e: React.SyntheticEvent) => {
    if (isFrozenControl(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      className="frozen contents"
      onClickCapture={stop}
      onChangeCapture={stop}
      onSubmitCapture={(e) => {
        if (!(e.target as Element).closest("[data-view]")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onKeyDownCapture={(e) => {
        if (e.key !== "Tab") stop(e);
      }}
    >
      {children}
    </div>
  );
}
