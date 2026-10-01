"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const weekdays = ["L", "M", "X", "J", "V", "S", "D"];

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return year && month && day ? new Date(year, month - 1, day) : new Date();
}

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function DatePicker({ name, label, defaultValue, disabled = false }: {
  name: string;
  label: string;
  defaultValue: string;
  disabled?: boolean;
}) {
  const initialDate = parseDate(defaultValue);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(new Date(initialDate.getFullYear(), initialDate.getMonth(), 1));
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointer = (event: MouseEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const monthLabel = new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric" }).format(visibleMonth);
  const firstOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - mondayOffset);
  const days = Array.from({ length: 42 }, (_, index) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index));
  const selectedIso = isoDate(selectedDate);
  const todayIso = isoDate(new Date());

  return <div className="date-picker" ref={containerRef}>
    <input type="hidden" name={name} value={selectedIso} />
    <button
      className="date-picker-trigger"
      type="button"
      aria-label={`${label}: ${formatDate(selectedDate)}`}
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen((value) => !value)}
      disabled={disabled}
    >
      <span>{formatDate(selectedDate)}</span><CalendarDays size={18} aria-hidden="true" />
    </button>
    {open && <div className="date-picker-popover" role="dialog" aria-label={`Elegir ${label.toLowerCase()}`}>
      <div className="date-picker-month-nav">
        <button type="button" aria-label="Mes anterior" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={19} aria-hidden="true" /></button>
        <strong aria-live="polite">{monthLabel}</strong>
        <button type="button" aria-label="Mes siguiente" onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={19} aria-hidden="true" /></button>
      </div>
      <div className="date-picker-grid" role="group" aria-label={`Días de ${monthLabel}`}>
        {weekdays.map((day, index) => <span className="date-picker-weekday" key={`${day}-${index}`}>{day}</span>)}
        {days.map((day) => {
          const dateIso = isoDate(day);
          const isOutsideMonth = day.getMonth() !== visibleMonth.getMonth();
          return <button
            key={dateIso}
            className={`date-picker-day${isOutsideMonth ? " is-outside" : ""}${dateIso === selectedIso ? " is-selected" : ""}`}
            type="button"
            aria-label={new Intl.DateTimeFormat("es-ES", { dateStyle: "full" }).format(day)}
            aria-current={dateIso === todayIso ? "date" : undefined}
            aria-pressed={dateIso === selectedIso}
            onClick={() => { setSelectedDate(day); setVisibleMonth(new Date(day.getFullYear(), day.getMonth(), 1)); setOpen(false); }}
          >{day.getDate()}</button>;
        })}
      </div>
      <div className="date-picker-footer">
        <button type="button" onClick={() => { setSelectedDate(new Date()); setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setOpen(false); }}>Hoy</button>
      </div>
    </div>}
  </div>;
}
