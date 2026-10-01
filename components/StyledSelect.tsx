"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

export function StyledSelect({
  options,
  value,
  defaultValue,
  onValueChange,
  name,
  ariaLabel,
  menuLabel,
  className = "",
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  ariaLabel: string;
  menuLabel?: string;
  className?: string;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [innerValue, setInnerValue] = useState(defaultValue ?? options[0]?.value ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedValue = value ?? innerValue;
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === selectedValue));
  const selected = options[selectedIndex];

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function choose(option: SelectOption) {
    setInnerValue(option.value);
    onValueChange?.(option.value);
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActiveIndex(selectedIndex);
      } else {
        setActiveIndex((index) => (index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
      }
    } else if (event.key === "Enter" || event.key === " ") {
      if (!open) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(selectedIndex);
      } else {
        event.preventDefault();
        if (options[activeIndex]) choose(options[activeIndex]);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return <div ref={root} className={`styled-select${open ? " is-open" : ""} ${className}`.trim()} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    {name && <input type="hidden" name={name} value={selectedValue} />}
    <button
      type="button"
      className="styled-select-trigger"
      role="combobox"
      aria-label={ariaLabel}
      aria-controls={`${id}-options`}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-activedescendant={open ? `${id}-option-${activeIndex}` : undefined}
      onKeyDown={handleKeyDown}
      onClick={() => {
        setActiveIndex(selectedIndex);
        setOpen((isOpen) => !isOpen);
      }}
    >
      <span>{selected?.label ?? "Selecciona una opción"}</span>
      <ChevronDown size={17} aria-hidden="true" />
    </button>
    {open && <div className="styled-select-menu" id={`${id}-options`} role="listbox" aria-label={menuLabel ?? ariaLabel}>
      <p>{menuLabel ?? `${options.length} opciones`}</p>
      <ul>{options.map((option, index) => <li key={option.value}>
        <button
          id={`${id}-option-${index}`}
          type="button"
          role="option"
          aria-selected={option.value === selectedValue}
          className={index === activeIndex ? "is-highlighted" : undefined}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(option)}
        >
          <span>{option.label}</span>
          {option.value === selectedValue ? <Check size={17} aria-hidden="true" /> : <ArrowUpRight size={16} aria-hidden="true" />}
        </button>
      </li>)}</ul>
    </div>}
  </div>;
}
