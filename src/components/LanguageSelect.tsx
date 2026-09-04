"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/words";

type Props = {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
};

export function LanguageSelect({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() =>
    Math.max(0, LANGUAGES.findIndex((l) => l.code === value))
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ query: "", at: 0 });
  const listId = useId();

  const selected = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];
  const optionId = (code: string) => `${listId}-${code}`;

  function openList() {
    if (disabled) return;
    typeahead.current = { query: "", at: 0 };
    setActive(Math.max(0, LANGUAGES.findIndex((l) => l.code === value)));
    setOpen(true);
  }

  function closeList(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function select(code: string) {
    onChange(code);
    closeList();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function move(delta: number) {
    setActive((i) => (i + delta + LANGUAGES.length) % LANGUAGES.length);
  }

  function jumpTo(char: string, now: number) {
    const q = now - typeahead.current.at < 500 ? typeahead.current.query + char : char;
    typeahead.current = { query: q, at: now };
    const start = q.length === 1 ? active + 1 : active;
    for (let k = 0; k < LANGUAGES.length; k++) {
      const i = (start + k) % LANGUAGES.length;
      if (LANGUAGES[i].name.toLowerCase().startsWith(q)) {
        setActive(i);
        return;
      }
    }
  }

  function onTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " " || e.key === "Enter") {
      e.preventDefault();
      openList();
    } else if (e.key.length === 1 && /\S/.test(e.key)) {
      e.preventDefault();
      openList();
      jumpTo(e.key.toLowerCase(), e.timeStamp);
    }
  }

  function onListKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        move(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(LANGUAGES.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        select(LANGUAGES[active].code);
        break;
      case "Escape":
        e.preventDefault();
        closeList();
        break;
      case "Tab":
        closeList(false);
        break;
      default:
        if (e.key.length === 1 && /\S/.test(e.key)) {
          e.preventDefault();
          jumpTo(e.key.toLowerCase(), e.timeStamp);
        }
    }
  }

  return (
    <div ref={rootRef} className="relative w-fit">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`Language: ${selected.name}`}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={onTriggerKeyDown}
        className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-base outline-none hover:border-neutral-400 focus:border-neutral-900 disabled:opacity-50 aria-expanded:border-neutral-900"
      >
        <span aria-hidden="true">{selected.flag}</span>
        <span>{selected.name}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-1 size-4 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-label="Language"
          aria-activedescendant={optionId(LANGUAGES[active].code)}
          onKeyDown={onListKeyDown}
          className="absolute left-0 top-full z-20 mt-2 max-h-[min(30rem,60vh)] w-max min-w-full max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-lg outline-none"
        >
          {LANGUAGES.map((l, i) => {
            const isSelected = l.code === value;
            const isActive = i === active;
            return (
              <li
                key={l.code}
                id={optionId(l.code)}
                role="option"
                aria-selected={isSelected}
                data-index={i}
                onPointerMove={() => setActive(i)}
                onClick={() => select(l.code)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-base ${
                  isActive ? "bg-neutral-100" : ""
                } ${isSelected ? "font-medium" : ""}`}
              >
                <span aria-hidden="true">{l.flag}</span>
                <span className="flex-1 whitespace-nowrap">{l.name}</span>
                {isSelected && (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4 text-neutral-900"
                  >
                    <path d="M4 10.5 8 14.5 16 6" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
