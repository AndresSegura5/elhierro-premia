"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, createBusinessWithMerchant, deleteBusinessAndAccess, restoreBusinessWithAccess, syncMerchantUsername } from "@/lib/auth";
import { demoWritesEnabled, getBusinessRecord, listBusinessCategories, updateBusinessRecord } from "@/lib/store";
import { locateBusinessAddress } from "@/lib/geocoding";
import { localPhoneNumber } from "@/lib/phone";
import type { Business, Municipality } from "@/lib/types";

export type BusinessAdminState = {
  error: string;
  success?: string;
  credentials?: { businessName: string; username: string; password: string };
};

const municipalities: Municipality[] = ["Valverde", "La Frontera", "El Pinar"];

function readBusiness(formData: FormData): Omit<Business, "id" | "lat" | "lng"> {
  const name = String(formData.get("name") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const municipality = String(formData.get("municipality") ?? "");
  const address = String(formData.get("address") ?? "").trim();
  const phone = localPhoneNumber(String(formData.get("phone") ?? ""));
  if (!name || !category || !address || !phone) throw new Error("Completa el nombre, categoría, dirección y teléfono del comercio.");
  if (name.length > 100 || category.length > 80 || address.length > 150 || phone.length > 50) throw new Error("Revisa la longitud del nombre, categoría, dirección o teléfono.");
  if (!municipalities.includes(municipality as Municipality)) throw new Error("Selecciona un municipio válido.");
  return {
    name,
    category,
    municipality: municipality as Municipality,
    area: municipality,
    address,
    phone,
    openingHours: String(formData.get("openingHours") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    image: String(formData.get("image") ?? "").trim(),
  };
}

function readMapLocation(formData: FormData) {
  const latValue = String(formData.get("lat") ?? "").trim();
  const lngValue = String(formData.get("lng") ?? "").trim();
  if (!latValue && !lngValue) return null;
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 27.59 || lat > 27.86 || lng < -18.26 || lng > -17.82) {
    throw new Error("Coloca el marcador en una ubicación válida de El Hierro.");
  }
  return { lat, lng };
}

function refreshBusinessPages() {
  for (const path of ["/admin", "/admin/comercios", "/admin/carreras", "/comercios", "/", "/bono"]) revalidatePath(path);
}

export async function createBusinessAction(_state: BusinessAdminState, formData: FormData): Promise<BusinessAdminState> {
  await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de comercios necesita una base de datos persistente habilitada." };
  try {
    const draft = readBusiness(formData);
    if (!(await listBusinessCategories()).includes(draft.category)) throw new Error("Selecciona una categoría de la lista.");
    const location = readMapLocation(formData) ?? await locateBusinessAddress(draft.address, draft.municipality);
    const business = { ...draft, ...location };
    const result = await createBusinessWithMerchant(business);
    refreshBusinessPages();
    return { error: "", credentials: { businessName: result.business.name, username: result.username, password: result.password } };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el comercio." };
  }
}

export async function updateBusinessAction(_state: BusinessAdminState, formData: FormData): Promise<BusinessAdminState> {
  await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de comercios necesita una base de datos persistente habilitada." };
  try {
    const id = String(formData.get("businessId") ?? "");
    if (!id) throw new Error("No se indicó el comercio que quieres editar.");
    const existing = await getBusinessRecord(id);
    if (!existing) throw new Error("No se encontró el comercio que quieres editar.");
    const draft = readBusiness(formData);
    if (!(await listBusinessCategories()).includes(draft.category)) throw new Error("Selecciona una categoría de la lista.");
    const location = readMapLocation(formData) ?? (existing.address === draft.address && existing.municipality === draft.municipality
      ? { lat: existing.lat, lng: existing.lng }
      : await locateBusinessAddress(draft.address, draft.municipality));
    await updateBusinessRecord({ ...draft, ...location, id });
    if (existing.name !== draft.name) await syncMerchantUsername(id, draft.name);
    refreshBusinessPages();
    return { error: "", success: "Los datos del comercio se han actualizado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el comercio." };
  }
}

export async function deleteBusinessAction(_state: BusinessAdminState, formData: FormData): Promise<BusinessAdminState> {
  const session = await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de comercios necesita una base de datos persistente habilitada." };
  try {
    await deleteBusinessAndAccess(String(formData.get("businessId") ?? ""), { id: session.id, username: session.username });
    refreshBusinessPages();
    return { error: "", success: "Comercio retirado del directorio. Su ficha y su histórico quedan conservados." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo archivar el comercio." };
  }
}

export async function restoreBusinessAction(_state: BusinessAdminState, formData: FormData): Promise<BusinessAdminState> {
  await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de comercios necesita una base de datos persistente habilitada." };
  try {
    const credentials = await restoreBusinessWithAccess(String(formData.get("businessId") ?? ""));
    refreshBusinessPages();
    return { error: "", success: "Comercio reactivado.", credentials };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo reactivar el comercio." };
  }
}
