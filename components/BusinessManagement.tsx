"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, MapPin, Pencil, Plus, RotateCcw, Save, Store, Trash2, X } from "lucide-react";
import { createBusinessAction, deleteBusinessAction, restoreBusinessAction, updateBusinessAction, type BusinessAdminState } from "@/app/admin/business-actions";
import { StyledSelect } from "@/components/StyledSelect";
import { initialBusinessUsername } from "@/lib/business-credentials";
import { localPhoneNumber } from "@/lib/phone";
import type { Business, ManagedBusiness, Municipality } from "@/lib/types";
import { normalizeTableSearch, TableColumnHeader, type TableSortDirection } from "@/components/InteractiveTable";
import "leaflet/dist/leaflet.css";

const initialState: BusinessAdminState = { error: "" };
type Location = { lat: number; lng: number };
const municipalityOptions = ["Valverde", "La Frontera", "El Pinar"] as const;
const businessTableColumns = [
  { key: "name", label: "Comercio" }, { key: "address", label: "Dirección" }, { key: "phone", label: "Teléfono" },
  { key: "username", label: "Usuario" }, { key: "password", label: "Acceso" },
];

function BusinessFields({ business, categories }: { business?: Business; categories: string[] }) {
  const [address, setAddress] = useState(business?.address ?? "");
  const [phone, setPhone] = useState(business ? localPhoneNumber(business.phone) : "");
  const [municipality, setMunicipality] = useState<Municipality>(business?.municipality ?? "Valverde");
  const [location, setLocation] = useState<Location | null>(business ? { lat: business.lat, lng: business.lng } : null);
  const [locationStatus, setLocationStatus] = useState(business ? "Punto actual del comercio. Arrastra el marcador si necesitas corregirlo." : "Escribe la dirección para localizar el punto automáticamente.");
  const [locating, setLocating] = useState(false);
  const requestId = useRef(0);
  const locationWasDragged = useRef(false);
  async function locateAddress(addressToFind = address, municipalityToFind = municipality) {
    if (!addressToFind.trim()) {
      setLocationStatus("Escribe la dirección antes de buscarla.");
      return;
    }
    const currentRequest = ++requestId.current;
    locationWasDragged.current = false;
    setLocating(true);
    setLocationStatus("Buscando la dirección en el mapa…");
    try {
      const response = await fetch("/api/admin/geocode-business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addressToFind, municipality: municipalityToFind }),
      });
      const result = await response.json() as Location & { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo localizar la dirección.");
      if (currentRequest !== requestId.current || locationWasDragged.current) return;
      setLocation({ lat: result.lat, lng: result.lng });
      setLocationStatus("Punto encontrado. Arrastra el marcador para ajustarlo.");
    } catch (error) {
      if (currentRequest !== requestId.current) return;
      setLocationStatus(error instanceof Error ? error.message : "No se pudo localizar la dirección.");
    } finally {
      if (currentRequest === requestId.current) setLocating(false);
    }
  }

  function changeAddress(value: string) {
    requestId.current += 1;
    locationWasDragged.current = false;
    setAddress(value);
    setLocation(null);
    setLocating(false);
    setLocationStatus("La búsqueda se iniciará al salir del campo de dirección.");
  }

  function changeMunicipality(value: string) {
    requestId.current += 1;
    locationWasDragged.current = false;
    setMunicipality(value as Municipality);
    setLocation(null);
    setLocating(false);
    setLocationStatus("La búsqueda se iniciará al salir del campo de dirección.");
    if (address.trim()) void locateAddress(address, value as Municipality);
  }

  function moveLocation(next: Location) {
    locationWasDragged.current = true;
    setLocation(next);
    setLocating(false);
    setLocationStatus("Punto colocado o ajustado manualmente. Se guardará esta ubicación.");
  }

  return <>
    <div className="business-form-grid">
      <label><span>Nombre del comercio *</span><input name="name" required defaultValue={business?.name} placeholder="Ej. Tienda Los Mocanes" /></label>
      <div className="business-form-field"><span>Categoría *</span><StyledSelect ariaLabel="Categoría" menuLabel="Selecciona una categoría" name="category" defaultValue={business?.category ?? ""} options={[{ value: "", label: "Selecciona una categoría" }, ...categories.map((category) => ({ value: category, label: category }))]} /></div>
      <div className="business-form-field"><span>Municipio *</span><StyledSelect ariaLabel="Municipio" menuLabel="Selecciona un municipio" name="municipality" value={municipality} onValueChange={changeMunicipality} options={municipalityOptions.map((name) => ({ value: name, label: name }))} /></div>
      <label><span>Teléfono *</span><input name="phone" type="tel" required value={phone} onChange={(event) => setPhone(localPhoneNumber(event.target.value))} placeholder="922000000" /></label>
      <div className="business-address-field business-form-wide">
        <label htmlFor="business-address">Dirección *</label>
        <input id="business-address" name="address" required value={address} onChange={(event) => changeAddress(event.target.value)} onBlur={() => void locateAddress()} placeholder="Calle y número" />
      </div>
      <label><span>Horario</span><input name="openingHours" defaultValue={business?.openingHours} placeholder="L-S 09:00-18:00" /></label>
      <label><span>Imagen (ruta o URL)</span><input name="image" defaultValue={business?.image} placeholder="/images/businesses/comercio.jpg" /></label>
      <label className="business-form-wide"><span>Descripción</span><textarea name="description" rows={3} defaultValue={business?.description} placeholder="Describe brevemente el comercio" /></label>
    </div>
    <input type="hidden" name="lat" value={location?.lat ?? ""} />
    <input type="hidden" name="lng" value={location?.lng ?? ""} />
    <div className="business-location-picker">
      <div className="business-location-heading"><strong>Ubicación del comercio</strong><span className={locating ? "is-locating" : location ? "is-located" : ""} role="status">{locationStatus}</span></div>
      <BusinessMapPicker position={location} onPositionChange={moveLocation} />
      <small>Al salir del campo de dirección se buscará automáticamente. Si no aparece, haz clic en el mapa para colocar el punto o arrastra el marcador.</small>
    </div>
  </>;
}

function BusinessMapPicker({ position, onPositionChange }: { position: Location | null; onPositionChange: (position: Location) => void }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<import("leaflet").Map | null>(null);
  const marker = useRef<import("leaflet").Marker | null>(null);
  const positionRef = useRef(position);
  const [ready, setReady] = useState(false);
  positionRef.current = position;
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;

  useEffect(() => {
    let disposed = false;
    let instance: import("leaflet").Map | null = null;
    let resizeObserver: ResizeObserver | undefined;
    (async () => {
      const L = await import("leaflet");
      if (disposed || !element.current) return;
      const islandBounds = L.latLngBounds([[27.59, -18.26], [27.86, -17.82]]);
      instance = L.map(element.current, { zoomControl: true, maxBounds: islandBounds, maxBoundsViscosity: 0.9 }).setView([27.75, -17.98], 11);
      map.current = instance;
      instance.on("click", (event: import("leaflet").LeafletMouseEvent) => {
        if (islandBounds.contains(event.latlng)) onPositionChangeRef.current({ lat: event.latlng.lat, lng: event.latlng.lng });
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(instance);
      resizeObserver = new ResizeObserver(() => instance?.invalidateSize());
      resizeObserver.observe(element.current);
      setReady(true);
    })();
    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      instance?.remove();
      map.current = null;
      marker.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;
    if (!position) {
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      return;
    }
    if (!marker.current) {
      import("leaflet").then((L) => {
        const currentPosition = positionRef.current;
        if (!map.current || marker.current || !currentPosition) return;
        marker.current = L.marker([currentPosition.lat, currentPosition.lng], {
          draggable: true,
          icon: L.divIcon({ className: "business-location-marker", html: "<span></span>", iconSize: [26, 34], iconAnchor: [13, 30] }),
        }).addTo(map.current);
        marker.current.on("dragend", () => {
          const point = marker.current?.getLatLng();
          if (!point || !map.current) return;
          const bounds = L.latLngBounds([[27.59, -18.26], [27.86, -17.82]]);
          if (!bounds.contains(point)) {
            const previous = positionRef.current;
            if (previous) marker.current?.setLatLng([previous.lat, previous.lng]);
            return;
          }
          onPositionChangeRef.current({ lat: point.lat, lng: point.lng });
        });
        map.current.setView([currentPosition.lat, currentPosition.lng], Math.max(map.current.getZoom(), 15), { animate: true });
      });
      return;
    }
    const current = marker.current.getLatLng();
    if (Math.abs(current.lat - position.lat) > 0.00001 || Math.abs(current.lng - position.lng) > 0.00001) {
      marker.current.setLatLng([position.lat, position.lng]);
      instance.setView([position.lat, position.lng], Math.max(instance.getZoom(), 15), { animate: true });
    }
  }, [position, ready]);

  return <div className="business-location-map" ref={element} aria-label="Mapa para ajustar la ubicación del comercio" />;
}

function CredentialResult({ state }: { state: BusinessAdminState }) {
  if (state.error) return <p className="admin-notice admin-notice--error" role="alert">{state.error}</p>;
  if (!state.credentials) return state.success ? <p className="business-action-success" role="status">{state.success}</p> : null;
  return <div className="admin-credential" role="status">
    <strong>Acceso creado para {state.credentials.businessName}</strong>
    <p>Usuario: <code>{state.credentials.username}</code></p>
    <p>Contraseña temporal: <code>{state.credentials.password}</code></p>
    <small>Se ha generado aleatoriamente y solo se muestra ahora. Guárdala y entrégala por un canal privado.</small>
  </div>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    document.body.classList.add("has-business-modal");
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.classList.remove("has-business-modal");
    };
  }, [onClose]);

  return <div className="business-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="business-modal" role="dialog" aria-modal="true" aria-labelledby="business-modal-title">
      <header className="business-modal-heading"><div className="panel-title"><Store size={20} aria-hidden="true" /><h2 id="business-modal-title">{title}</h2></div><button className="business-modal-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>
      {children}
    </section>
  </div>;
}

export function BusinessManagement({ businesses, accounts, categories }: {
  businesses: ManagedBusiness[];
  accounts: Array<{ username: string; business_id: string }>;
  categories: string[];
}) {
  const [createState, createAction, creating] = useActionState(createBusinessAction, initialState);
  const [createOpen, setCreateOpen] = useState(false);
  const [businessPage, setBusinessPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<{ key: string; direction: TableSortDirection } | null>(null);
  const businessPageSize = 10;
  const filteredBusinesses = useMemo(() => {
    const rows = businesses.map((item) => {
      const accountRecord = accounts.find((entry) => entry.business_id === item.business.id);
      const account = !item.isActive ? "Acceso desactivado" : accountRecord?.username ?? initialBusinessUsername(item.business.name);
      const password = !item.isActive ? "Acceso desactivado" : accountRecord ? "Clave privada; restablecer para renovarla" : "Sin acceso";
      const values = { name: item.business.name, address: `${item.business.address}, ${item.business.municipality}`, phone: localPhoneNumber(item.business.phone), username: account, password };
      return { item, account: accountRecord?.username, values };
    }).filter(({ values }) => businessTableColumns.every((column) => !filters[column.key] || normalizeTableSearch(values[column.key as keyof typeof values]).includes(normalizeTableSearch(filters[column.key]))));
    if (sort) rows.sort((left, right) => {
      const comparison = left.values[sort.key as keyof typeof left.values].localeCompare(right.values[sort.key as keyof typeof right.values], "es", { numeric: true, sensitivity: "base" });
      return sort.direction === "asc" ? comparison : -comparison;
    });
    return rows;
  }, [businesses, accounts, filters, sort]);
  const businessPageCount = Math.max(1, Math.ceil(filteredBusinesses.length / businessPageSize));
  const currentBusinessPage = Math.min(businessPage, businessPageCount);
  const visibleBusinesses = filteredBusinesses.slice((currentBusinessPage - 1) * businessPageSize, currentBusinessPage * businessPageSize);

  function setColumnFilter(key: string, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setBusinessPage(1);
  }

  function sortColumn(key: string) {
    setSort((current) => ({ key, direction: current?.key === key && current.direction === "asc" ? "desc" : "asc" }));
    setBusinessPage(1);
  }

  return <div className="business-management">
    <section className="business-managed-list" aria-labelledby="business-list-title">
      <div className="business-managed-heading">
        <div className="panel-title"><Store size={21} aria-hidden="true" /><h2 id="business-list-title">{businesses.length} {businesses.length === 1 ? "Comercio registrado" : "Comercios registrados"}</h2></div>
        <div className="business-managed-tools">
          <div className="merchant-export-actions" aria-label="Exportar comercios registrados">
            <a href="/admin/export?type=businesses&format=pdf"><FileDown size={16} aria-hidden="true" />PDF</a>
            <a href="/admin/export?type=businesses&format=xlsx"><FileSpreadsheet size={16} aria-hidden="true" />Excel</a>
          </div>
          <button className="button business-managed-add" type="button" onClick={() => setCreateOpen(true)}><Plus size={17} aria-hidden="true" />Añadir comercio</button>
        </div>
      </div>
      {businesses.length ? <div className="business-table-wrap"><table className="business-table">
        <thead><tr>{businessTableColumns.map((column) => <TableColumnHeader key={column.key} column={column} filterValue={filters[column.key] ?? ""} onFilter={(value) => setColumnFilter(column.key, value)} sortDirection={sort?.key === column.key ? sort.direction : undefined} onSort={() => sortColumn(column.key)} />)}<th><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{visibleBusinesses.length ? visibleBusinesses.map(({ item: { business, isActive }, account }) => <BusinessRow key={business.id} business={business} active={isActive} account={account} categories={categories} />) : <tr><td colSpan={6} className="interactive-table-empty">No hay comercios que coincidan con los filtros.</td></tr>}</tbody>
      </table></div> : <p className="merchant-ledger-empty">Todavía no hay comercios registrados.</p>}
      {(filteredBusinesses.length > businessPageSize || Object.values(filters).some(Boolean)) && <nav className="record-pagination" aria-label="Paginación de comercios">
        <span>Mostrando {filteredBusinesses.length ? (currentBusinessPage - 1) * businessPageSize + 1 : 0}–{Math.min(currentBusinessPage * businessPageSize, filteredBusinesses.length)} de {filteredBusinesses.length.toLocaleString("es-ES")} comercios</span>
        <div>
          <button type="button" onClick={() => setBusinessPage((page) => Math.max(1, page - 1))} disabled={currentBusinessPage === 1} aria-label="Página anterior"><ChevronLeft size={17} aria-hidden="true" />Anterior</button>
          <strong aria-current="page">{currentBusinessPage} / {businessPageCount}</strong>
          <button type="button" onClick={() => setBusinessPage((page) => Math.min(businessPageCount, page + 1))} disabled={currentBusinessPage === businessPageCount} aria-label="Página siguiente">Siguiente<ChevronRight size={17} aria-hidden="true" /></button>
        </div>
      </nav>}
    </section>

    {createOpen && <Modal title="Añadir comercio" onClose={() => setCreateOpen(false)}>
      <p className="business-modal-description">Al guardarlo se creará también su usuario y su contraseña inicial.</p>
      <p className="business-geocoding-note">El punto del mapa se calculará automáticamente con la dirección y el municipio. Geocodificación: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>.</p>
      <form className="business-modal-form" action={createAction}>
        <BusinessFields categories={categories} />
        <button className="button" type="submit" disabled={creating}><Plus size={17} aria-hidden="true" />{creating ? "Creando…" : "Crear comercio y acceso"}</button>
      </form>
      <CredentialResult state={createState} />
    </Modal>}
  </div>;
}

function BusinessRow({ business, active, account, categories }: { business: Business; active: boolean; account?: string; categories: string[] }) {
  const [updateState, updateAction, updating] = useActionState(updateBusinessAction, initialState);
  const [deleteState, deleteAction, deleting] = useActionState(deleteBusinessAction, initialState);
  const [restoreState, restoreAction, restoring] = useActionState(restoreBusinessAction, initialState);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return <>
    <tr className={!active ? "is-inactive" : undefined}>
      <td><strong>{business.name}</strong></td>
      <td><span className="business-table-address"><MapPin size={14} aria-hidden="true" />{business.address}, {business.municipality}</span></td>
      <td>{localPhoneNumber(business.phone)}</td>
      <td>{account ?? initialBusinessUsername(business.name)}</td>
      <td><code className="business-table-password">{!active ? "Acceso desactivado" : account ? "Clave privada; restablecer para renovarla" : "Sin acceso"}</code></td>
      <td><div className="business-table-actions">
        {active && <button className="business-icon-action" type="button" onClick={() => setEditOpen(true)} aria-label={`Editar ${business.name}`} title="Editar"><Pencil size={17} /></button>}
        {active ? <button className="business-icon-action is-danger" type="button" onClick={() => setConfirmDeleteOpen(true)} aria-label={`Borrar ${business.name}`} title="Borrar"><Trash2 size={17} /></button> : <form action={restoreAction}><input type="hidden" name="businessId" value={business.id} /><button className="business-icon-action" type="submit" disabled={restoring} aria-label={`Reactivar ${business.name}`} title="Reactivar"><RotateCcw size={17} /></button></form>}
      </div></td>
    </tr>
    {(deleteState.error || deleteState.success || restoreState.error || restoreState.success || restoreState.credentials) && <tr><td colSpan={6}><CredentialResult state={deleteState.error || deleteState.success ? deleteState : restoreState} /></td></tr>}
    {editOpen && <Modal title={`Editar ${business.name}`} onClose={() => setEditOpen(false)}>
      <form className="business-modal-form" action={updateAction}>
        <input type="hidden" name="businessId" value={business.id} />
        <BusinessFields business={business} categories={categories} />
        <button className="button subtle" type="submit" disabled={updating}><Save size={16} aria-hidden="true" />{updating ? "Guardando…" : "Guardar cambios"}</button>
      </form>
      <CredentialResult state={updateState} />
    </Modal>}
    {confirmDeleteOpen && <Modal title="Borrar comercio" onClose={() => setConfirmDeleteOpen(false)}>
      <p className="business-delete-confirm-copy">¿Quieres borrar <strong>{business.name}</strong>? Si tiene bonos asociados, se retirará del directorio y se conservará su historial. Si no, se eliminará del sistema.</p>
      <div className="business-modal-actions">
        <button className="button subtle" type="button" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</button>
        <form action={deleteAction} onSubmit={() => setConfirmDeleteOpen(false)}>
          <input type="hidden" name="businessId" value={business.id} />
          <button className="button business-delete-confirm-button" type="submit" disabled={deleting}><Trash2 size={16} aria-hidden="true" />{deleting ? "Borrando…" : "Borrar comercio"}</button>
        </form>
      </div>
      <CredentialResult state={deleteState} />
    </Modal>}
  </>;
}
