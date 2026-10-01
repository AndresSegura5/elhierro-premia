import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function RecordPagination({ page, pageSize = 10, total, label, hrefForPage, ariaLabel = "Paginación", scrollTargetId }: {
  page: number;
  pageSize?: number;
  total: number;
  label: string;
  hrefForPage: (page: number) => string;
  ariaLabel?: string;
  scrollTargetId?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pageHref = (nextPage: number) => `${hrefForPage(nextPage)}${scrollTargetId ? `#${scrollTargetId}` : ""}`;
  return <nav className="record-pagination" aria-label={ariaLabel}>
    <span>Mostrando {first}–{last} de {total.toLocaleString("es-ES")} {label}</span>
    <div>
      {page > 1 ? <Link href={pageHref(page - 1)} aria-label="Página anterior"><ChevronLeft size={17} aria-hidden="true" />Anterior</Link> : <span className="is-disabled"><ChevronLeft size={17} aria-hidden="true" />Anterior</span>}
      <strong aria-current="page">{page} / {pageCount}</strong>
      {page < pageCount ? <Link href={pageHref(page + 1)} aria-label="Página siguiente">Siguiente<ChevronRight size={17} aria-hidden="true" /></Link> : <span className="is-disabled">Siguiente<ChevronRight size={17} aria-hidden="true" /></span>}
    </div>
  </nav>;
}
