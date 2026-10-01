"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

export type TableSortDirection = "asc" | "desc";
export type InteractiveTableColumn = {
  key: string;
  label: string;
  searchable?: boolean;
  sortable?: boolean;
};
export type InteractiveTableRow = {
  key: string;
  searchValues: Record<string, string>;
  sortValues: Record<string, string | number>;
  cells: Record<string, ReactNode>;
};

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });
export function normalizeTableSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function TableColumnHeader({ column, filterValue = "", onFilter, sortDirection, onSort }: {
  column: InteractiveTableColumn;
  filterValue?: string;
  onFilter?: (value: string) => void;
  sortDirection?: TableSortDirection;
  onSort?: () => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const searchable = column.searchable !== false;
  const sortable = column.sortable !== false;
  return <th>
    <div className="table-column-heading">
      <span>{column.label}</span>
      {sortable && onSort && <button className="table-sort-button" type="button" onClick={onSort} aria-label={`Ordenar ${column.label} ${sortDirection === "asc" ? "de forma descendente" : "de forma ascendente"}`} title={sortDirection === "asc" ? "Orden ascendente · pulsa para descendente" : sortDirection === "desc" ? "Orden descendente · pulsa para ascendente" : "Ordenar ascendente"}>
        {sortDirection === "asc" ? "↑" : sortDirection === "desc" ? "↓" : "↕"}
      </button>}
      {searchable && onFilter && <button
        className={`table-filter-toggle${filterValue ? " is-active" : ""}`}
        type="button"
        onClick={() => setFilterOpen((open) => !open)}
        aria-label={`${filterOpen ? "Ocultar" : "Mostrar"} filtro de ${column.label}`}
        aria-expanded={filterOpen}
        title={filterValue ? `Filtro activo: ${filterValue}` : `Buscar en ${column.label}`}
      ><Search size={15} aria-hidden="true" /></button>}
    </div>
    {searchable && onFilter && filterOpen && <input autoFocus className="table-column-search" type="search" value={filterValue} onChange={(event) => onFilter(event.target.value)} placeholder="Contiene…" aria-label={`Buscar en ${column.label}; el texto debe estar contenido`} />}
  </th>;
}

export function InteractiveTable({ columns, rows, ariaLabel, label, emptyMessage = "No hay registros.", pageSize = 10, className = "", initialSort }: {
  columns: InteractiveTableColumn[];
  rows: InteractiveTableRow[];
  ariaLabel: string;
  label: string;
  emptyMessage?: string;
  pageSize?: number;
  className?: string;
  initialSort?: { key: string; direction: TableSortDirection };
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: TableSortDirection } | null>(() => initialSort ?? null);
  const [page, setPage] = useState(1);
  const filteredRows = useMemo(() => {
    const result = rows.filter((row) => columns.every((column) => {
      const filter = filters[column.key];
      if (column.searchable === false || !filter) return true;
      return normalizeTableSearch(row.searchValues[column.key] ?? "").includes(normalizeTableSearch(filter));
    }));
    if (sort) {
      const direction = sort.direction === "asc" ? 1 : -1;
      result.sort((left, right) => {
        const a = left.sortValues[sort.key] ?? "";
        const b = right.sortValues[sort.key] ?? "";
        const comparison = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
        return comparison * direction;
      });
    }
    return result;
  }, [columns, filters, rows, sort]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const first = filteredRows.length ? (currentPage - 1) * pageSize + 1 : 0;
  const last = Math.min(currentPage * pageSize, filteredRows.length);

  function setFilter(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function sortColumn(key: string) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  }

  return <>
    <div className="table-wrap">
      <table className={className} aria-label={ariaLabel}>
        <thead><tr>{columns.map((column) => <TableColumnHeader key={column.key} column={column} filterValue={filters[column.key] ?? ""} onFilter={(value) => setFilter(column.key, value)} sortDirection={sort?.key === column.key ? sort.direction : undefined} onSort={() => sortColumn(column.key)} />)}</tr></thead>
        <tbody>{visibleRows.length ? visibleRows.map((row) => <tr key={row.key}>{columns.map((column) => <td key={column.key}>{row.cells[column.key] ?? "—"}</td>)}</tr>) : <tr><td className="interactive-table-empty" colSpan={columns.length}>{rows.length ? "No hay resultados para esos filtros." : emptyMessage}</td></tr>}</tbody>
      </table>
    </div>
    {(filteredRows.length > pageSize || Object.values(filters).some(Boolean)) && <nav className="record-pagination" aria-label={`Paginación de ${label}`}>
      <span>Mostrando {first}–{last} de {filteredRows.length.toLocaleString("es-ES")} {label}</span>
      <div>
        <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label="Página anterior"><ChevronLeft size={17} aria-hidden="true" />Anterior</button>
        <strong aria-current="page">{currentPage} / {pageCount}</strong>
        <button type="button" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount} aria-label="Página siguiente">Siguiente<ChevronRight size={17} aria-hidden="true" /></button>
      </div>
    </nav>}
  </>;
}
