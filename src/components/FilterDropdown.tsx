"use client";

import { useEffect, useRef } from "react";

export default function FilterDropdown<T extends string>({
  label,
  options,
  labels,
  selected,
  onChange,
  isOpen,
  onToggle,
}: {
  label: string;
  options: T[];
  labels?: Record<T, string>;
  selected: T[];
  onChange: (v: T[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen, onToggle]);

  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:border-apricot"
      >
        {label}
        {selected.length > 0 && (
          <span className="ml-1 rounded-full bg-apricot px-1.5 text-xs text-white">
            {selected.length}
          </span>
        )}
        <span className={`text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`}>▾</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 z-20 mt-2 w-48 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
          {options.map((opt) => (
            <label key={opt} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-stone">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
              {labels ? labels[opt] : opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
