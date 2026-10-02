import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, CircleCheck, CircleDashed, Clock3, FileDown, FileSpreadsheet, Printer, QrCode, Wallet } from "lucide-react";
import { AdminRaceSelector } from "@/components/AdminRaceSelector";
import { DatePicker } from "@/components/DatePicker";
import { ResetRaceCouponsButton } from "@/components/ResetRaceCouponsButton";
import { InteractiveTable, type InteractiveTableColumn, type InteractiveTableRow } from "@/components/InteractiveTable";
import { Header } from "@/components/Header";
import { requireAdmin } from "@/lib/auth";
import { addDays, formatDate, formatDateTime, formatEuros } from "@/lib/bonos";
import { demoWritesEnabled, listAllBusinesses, listRaceCoupons, listRaceRedemptions, listRaces } from "@/lib/store";
import { generateRaceCoupons, saveRaceSettings } from "../actions";
import { AdminSectionNav } from "@/components/AdminSectionNav";
import { PrintCouponsLinks } from "@/components/PrintCouponsLinks";
import "../admin.css";

export const metadata: Metadata = { title: "Gestión de carreras y bonos | El Hierro Premia Deportistas" };
export const dynamic = "force-dynamic";

const statusLabels = {
  "not-started": "Aún no vigente",
  available: "Disponible",
  partial: "Uso parcial",
  redeemed: "Agotado",
  expired: "Caducado",
};

export default async function AdminPage({ searchParams }: {
  searchParams: Promise<{ carrera?: string | string[]; bonosPagina?: string | string[]; gastosPagina?: string | string[]; comerciosPagina?: string | string[]; notice?: string; error?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const races = await listRaces();
  const selectedId = typeof params.carrera === "string" ? params.carrera : undefined;
  const race = races.find((item) => item.id === selectedId);
  const raceCoupons = race ? await listRaceCoupons(race.id) : [];
  const redemptions = race ? await listRaceRedemptions(race.id) : [];
  const remainingToIssue = race ? Math.max(0, race.couponQuantity - raceCoupons.length) : 0;
  const withBalance = raceCoupons.filter((coupon) => coupon.status === "available" || coupon.status === "partial").length;
  const partial = raceCoupons.filter((coupon) => coupon.status === "partial").length;
  const exhausted = raceCoupons.filter((coupon) => coupon.status === "redeemed").length;
  const canWrite = demoWritesEnabled();
  const businesses = await listAllBusinesses();
  const businessNames = new Map(businesses.map((business) => [business.id, business.name]));
  const businessSpend = new Map(businesses.map((business) => [business.id, { business, amountCents: 0 }]));
  for (const redemption of redemptions) {
    const item = businessSpend.get(redemption.businessId);
    if (!item) continue;
    item.amountCents += redemption.amountCents;
  }
  const businessSpendRows = [...businessSpend.values()]
    .filter((item) => item.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents || a.business.name.localeCompare(b.business.name, "es"));
  const spendColumns: InteractiveTableColumn[] = [
    { key: "business", label: "Comercio" },
    { key: "amount", label: "Importe total" },
  ];
  const spendTableRows: InteractiveTableRow[] = businessSpendRows.map(({ business, amountCents }) => {
    const amount = formatEuros(amountCents);
    return { key: business.id, searchValues: { business: business.name, amount }, sortValues: { business: business.name, amount: amountCents }, cells: { business: <strong>{business.name}</strong>, amount: <strong>{amount}</strong> } };
  });
  const couponColumns: InteractiveTableColumn[] = [
    { key: "code", label: "Código" }, { key: "business", label: "Comercio asignado" },
    { key: "spent", label: "Gastado" }, { key: "balance", label: "Saldo" }, { key: "status", label: "Estado" },
    { key: "record", label: "Ficha", searchable: false, sortable: false },
  ];
  const couponTableRows: InteractiveTableRow[] = raceCoupons.map((coupon) => {
    const business = businessNames.get(coupon.businessId) ?? "Sin asignar";
    const spent = formatEuros(coupon.usedCents);
    const balance = formatEuros(coupon.amountCents - coupon.usedCents);
    const status = statusLabels[coupon.status];
    return { key: coupon.code, searchValues: { code: coupon.code, business, spent, balance, status }, sortValues: { code: coupon.code, business, spent: coupon.usedCents, balance: coupon.amountCents - coupon.usedCents, status }, cells: { code: <span className="mono">{coupon.code}</span>, business, spent, balance, status: <span className={`status-dot ${coupon.status}`}>{status}</span>, record: <Link href={`/bono/${coupon.code}`}>Abrir</Link> } };
  });
  const redemptionColumns: InteractiveTableColumn[] = [
    { key: "date", label: "Fecha y hora" }, { key: "code", label: "Bono" }, { key: "business", label: "Comercio" },
    { key: "amount", label: "Importe gastado" }, { key: "balance", label: "Saldo posterior" },
  ];
  const redemptionTableRows: InteractiveTableRow[] = redemptions.map((redemption) => {
    const date = formatDateTime(redemption.createdAt);
    const business = businessNames.get(redemption.businessId) ?? "Sin asignar";
    const amount = formatEuros(redemption.amountCents);
    const balance = formatEuros(redemption.balanceAfterCents);
    return { key: String(redemption.id), searchValues: { date, code: redemption.code, business, amount, balance }, sortValues: { date: redemption.createdAt, code: redemption.code, business, amount: redemption.amountCents, balance: redemption.balanceAfterCents }, cells: { date, code: <span className="mono">{redemption.code}</span>, business, amount, balance } };
  });

  return (
    <>
      <Header username={session.username} isAdmin={session.role === "admin"} />
      <main className="admin-main">
        <section className="admin-hero">
          <div>
            <p className="eyebrow">Panel de administración</p>
            <h1>Gestión de carreras</h1>
            <p>Temporada 2026 / 27 · Configuración y movimientos separados por prueba.</p>
          </div>
        </section>

        <AdminSectionNav active="races" isSuperuser={session.isSuperuser} />

        <div className="admin-race-toolbar">
          <AdminRaceSelector races={races} selectedId={race?.id} pathname="/admin/carreras" />
        </div>

        {race ? (
          <>
            {params.notice && <p className="admin-notice" role="status">{params.notice}</p>}
            {params.error && <p className="admin-notice admin-notice--error" role="alert">{params.error}</p>}
            {!canWrite && <p className="admin-notice admin-notice--error">La edición y los canjes están desactivados hasta conectar la base de datos persistente de producción.</p>}

            <section className="admin-race-summary" aria-label={`Datos de ${race.name}`}>
              <div className="admin-race-summary-title">
                {race.logoPath && <img className="admin-race-logo" src={race.logoPath} alt={`Logo de ${race.name}`} />}
                <span className="admin-race-mark" style={{ backgroundColor: race.color }} aria-hidden="true" />
                <h2>{race.name}</h2>
              </div>
              <dl>
                <div><dt>Inicio del bono</dt><dd>{formatDate(race.startDate)}</dd></div>
                <div><dt>Vencimiento</dt><dd>{formatDate(addDays(race.startDate, race.validityDays))}</dd></div>
                <div><dt>Vigencia</dt><dd>{race.validityDays} días</dd></div>
              </dl>
            </section>

            <details className="admin-compact-details">
              <summary><span><Clock3 size={19} aria-hidden="true" />Configuración y emisión</span><small>{raceCoupons.length.toLocaleString("es-ES")} / {race.couponQuantity.toLocaleString("es-ES")} bonos emitidos <ChevronDown size={17} aria-hidden="true" /></small></summary>
              <section className="admin-settings" aria-label="Configuración de la carrera">
              <form action={saveRaceSettings} className="admin-settings-form">
                <input type="hidden" name="raceId" value={race.id} />
                <label><span>Cantidad de bonos</span><input name="couponQuantity" type="number" min={Math.max(1, raceCoupons.length)} max="10000" step="1" defaultValue={race.couponQuantity} required disabled={!canWrite} /></label>
                <label><span>Inicio del bono</span><DatePicker key={`${race.id}-${race.startDate}`} name="startDate" label="Inicio del bono" defaultValue={race.startDate} disabled={!canWrite} /></label>
                <label><span>Vigencia (días)</span><input name="validityDays" type="number" min="1" max="365" step="1" defaultValue={race.validityDays} required disabled={!canWrite} /></label>
                <button type="submit" className="button" disabled={!canWrite}>Guardar</button>
              </form>
              <p className="admin-settings-note">El bono es válido desde el día de inicio hasta el final del día de vencimiento. Los cambios de fecha se aplican también a los bonos ya emitidos.</p>
              <div className="admin-issue-row">
                <p>{raceCoupons.length.toLocaleString("es-ES")} de {race.couponQuantity.toLocaleString("es-ES")} bonos emitidos</p>
                <div className="admin-issue-actions">
                  {raceCoupons.length > 0 && <ResetRaceCouponsButton raceId={race.id} raceName={race.name} couponCount={raceCoupons.length} redemptionCount={redemptions.length} />}
                  <form action={generateRaceCoupons}>
                    <input type="hidden" name="raceId" value={race.id} />
                    <button type="submit" className="button subtle" disabled={!canWrite || remainingToIssue === 0}>
                      <QrCode size={17} aria-hidden="true" />
                      {remainingToIssue ? `Emitir ${remainingToIssue.toLocaleString("es-ES")} ${remainingToIssue === 1 ? "bono pendiente" : "bonos pendientes"}` : "Emisión completa"}
                    </button>
                  </form>
                </div>
              </div>
              <p className="admin-settings-note">Los bonos se emiten sin dorsal asignado y pueden entregarse en cualquier orden. Cada bono queda ligado a un comercio activo. El sistema prioriza el que tenga menos bonos de esa carrera y desempata por orden alfabético.</p>
              </section>
            </details>

            <section className="metric-grid admin-race-metrics" aria-label="Indicadores de la carrera">
              <article><QrCode size={22} aria-hidden="true" /><strong>{raceCoupons.length.toLocaleString("es-ES")}</strong><span>bonos emitidos</span></article>
              <article><Wallet size={22} aria-hidden="true" /><strong>{withBalance.toLocaleString("es-ES")}</strong><span>con saldo vigente</span></article>
              <article><CircleCheck size={22} aria-hidden="true" /><strong>{exhausted.toLocaleString("es-ES")}</strong><span>agotados totalmente</span></article>
              <article><CircleDashed size={22} aria-hidden="true" /><strong>{partial.toLocaleString("es-ES")}</strong><span>agotados parcialmente</span></article>
            </section>

            <details id="gasto-por-comercio" className="admin-compact-details">
              <summary><span><Wallet size={19} aria-hidden="true" />Control del gasto por comercio</span><small><ChevronDown size={17} aria-hidden="true" /></small></summary>
              <section className="admin-panel admin-business-spend">
                {businessSpendRows.length ? (
                  <InteractiveTable columns={spendColumns} rows={spendTableRows} ariaLabel="Control del gasto por comercio" label="comercios con gasto" initialSort={{ key: "amount", direction: "desc" }} />
                ) : <p className="admin-table-empty">Aún no hay gastos registrados por comercio.</p>}
              </section>
            </details>

            <details id="bonos-emitidos" className="admin-compact-details" open={Boolean(params.bonosPagina)}>
              <summary><span><QrCode size={19} aria-hidden="true" />Bonos emitidos</span><small>{raceCoupons.length.toLocaleString("es-ES")} bonos <ChevronDown size={17} aria-hidden="true" /></small></summary>
              <section className="admin-panel admin-coupons-panel">
                <div className="admin-coupons-heading">
                  {raceCoupons.length > 0 && <details className="admin-print-options">
                    <summary className="button"><Printer size={17} aria-hidden="true" />Imprimir bonos<ChevronDown size={16} aria-hidden="true" /></summary>
                    <div>
                      <PrintCouponsLinks raceId={race.id} />
                    </div>
                  </details>}
                </div>
                {raceCoupons.length ? (
                  <InteractiveTable columns={couponColumns} rows={couponTableRows} ariaLabel={`Bonos de ${race.shortName}`} label="bonos" emptyMessage="Todavía no se han emitido bonos para esta carrera." initialSort={{ key: "code", direction: "asc" }} />
                ) : <p className="admin-table-empty">Todavía no se han emitido bonos para esta carrera.</p>}
              </section>
            </details>

            <details id="movimientos-gasto" className="admin-compact-details" open={Boolean(params.gastosPagina)}>
              <summary><span><Wallet size={19} aria-hidden="true" />Movimientos de gasto</span><small>{redemptions.length.toLocaleString("es-ES")} movimientos <ChevronDown size={17} aria-hidden="true" /></small></summary>
              <section className="admin-panel">
                <div className="admin-export-heading">
                  <div className="merchant-export-actions" aria-label="Exportar movimientos de gasto">
                    <Link href={`/admin/export?type=expenses&carrera=${encodeURIComponent(race.id)}&format=pdf`}><FileDown size={16} aria-hidden="true" />PDF</Link>
                    <Link href={`/admin/export?type=expenses&carrera=${encodeURIComponent(race.id)}&format=xlsx`}><FileSpreadsheet size={16} aria-hidden="true" />Excel</Link>
                  </div>
                </div>
                {redemptions.length ? (
                  <InteractiveTable columns={redemptionColumns} rows={redemptionTableRows} ariaLabel="Registro de gastos" label="movimientos" emptyMessage="Aún no hay gastos registrados." initialSort={{ key: "date", direction: "desc" }} />
                ) : <p className="admin-table-empty">Aún no hay gastos registrados.</p>}
              </section>
            </details>
          </>
        ) : (
          <section className="admin-empty" aria-live="polite">
            <h2>Selecciona una carrera</h2>
            <p>Elige la prueba que quieres administrar para configurar la cantidad de bonos, su vigencia y su emisión.</p>
          </section>
        )}
      </main>
    </>
  );
}
