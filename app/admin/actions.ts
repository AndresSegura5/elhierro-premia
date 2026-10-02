"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { deleteRaceCoupons as deleteRaceCouponsFromStore, demoWritesEnabled, getRace, issueMissingCoupons, saveRaceConfiguration } from "@/lib/store";

async function raceIdFrom(formData: FormData) {
  const id = String(formData.get("raceId") ?? "");
  if (!(await getRace(id))) throw new Error("Carrera no reconocida.");
  return id;
}

function finish(id: string, message: string, error = false): never {
  revalidatePath("/admin");
  revalidatePath("/admin/carreras");
  revalidatePath("/bono");
  revalidatePath("/");
  redirect(`/admin/carreras?carrera=${encodeURIComponent(id)}&${error ? "error" : "notice"}=${encodeURIComponent(message)}`);
}

export async function saveRaceSettings(formData: FormData) {
  await requireAdmin();
  const id = await raceIdFrom(formData);
  if (!demoWritesEnabled()) finish(id, "La edición está desactivada hasta conectar la base de datos persistente de producción.", true);
  try {
    await saveRaceConfiguration(
      id,
      Number(formData.get("couponQuantity")),
      String(formData.get("raceDate") ?? ""),
      String(formData.get("startDate") ?? ""),
      Number(formData.get("validityDays")),
    );
  } catch (error) {
    finish(id, error instanceof Error ? error.message : "No se pudo guardar la carrera.", true);
  }
  finish(id, "Configuración guardada.");
}

export async function generateRaceCoupons(formData: FormData) {
  await requireAdmin();
  const id = await raceIdFrom(formData);
  if (!demoWritesEnabled()) finish(id, "La emisión está desactivada hasta conectar la base de datos persistente de producción.", true);
  let generated: number;
  try {
    generated = await issueMissingCoupons(id);
  } catch (error) {
    finish(id, error instanceof Error ? error.message : "No se pudieron emitir los bonos.", true);
  }
  finish(id, generated ? `${generated} ${generated === 1 ? "bono emitido" : "bonos emitidos"} para esta carrera.` : "Todos los bonos previstos ya están emitidos.");
}

export async function deleteRaceCoupons(formData: FormData) {
  const session = await requireAdmin();
  const id = await raceIdFrom(formData);
  if (formData.get("understood") !== "true") finish(id, "Confirma que entiendes las consecuencias antes de archivar los bonos.", true);
  if (!demoWritesEnabled()) finish(id, "El archivado está desactivado hasta conectar la base de datos persistente de producción.", true);
  let result: { removedCoupons: number; removedRedemptions: number };
  try {
    result = await deleteRaceCouponsFromStore(id, { id: session.id, username: session.username });
  } catch (error) {
    finish(id, error instanceof Error ? error.message : "No se pudieron archivar los bonos.", true);
  }
  finish(id, `Se archivaron ${result.removedCoupons} bonos y se conservaron sus ${result.removedRedemptions} movimientos de gasto. Para volver a disponer de bonos, tendrás que emitir de nuevo el lote completo.`);
}
