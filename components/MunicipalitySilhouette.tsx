import { municipalityShapes } from "@/lib/municipality-shapes";
import type { Municipality } from "@/lib/types";

export function MunicipalitySilhouette({ municipality, className }: { municipality: Municipality; className?: string }) {
  return <svg className={className} viewBox="0 0 200 200" width="34" height="34" aria-hidden="true" focusable="false">
    <path d={municipalityShapes[municipality]} fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
  </svg>;
}
