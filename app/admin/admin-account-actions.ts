"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { changeAdminPassword, completeAdminPasswordSetup, createAdminAccount, getSession, requireAdmin, resetAdminPassword } from "@/lib/auth";
import { demoWritesEnabled } from "@/lib/store";

export type AdminActionState = { error: string; message?: string; temporaryPassword?: string };

export async function addAdminAccount(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de administradores necesita una base de datos persistente." };
  try {
    const result = await createAdminAccount(String(formData.get("firstName") ?? ""), String(formData.get("lastName") ?? ""), String(formData.get("email") ?? ""));
    revalidatePath("/admin/administradores");
    return { error: "", message: "Administrador creado. Comparte esta clave temporal con la persona; no se ha enviado por correo.", temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el administrador." };
  }
}

export async function resetAdminPasswordAction(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const session = await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de administradores necesita una base de datos persistente." };
  const targetId = Number(formData.get("userId"));
  try {
    const result = await resetAdminPassword(targetId, session.id);
    revalidatePath("/admin/administradores");
    return { error: "", message: "Clave temporal generada. El administrador elegirá una contraseña nueva al iniciar sesión.", temporaryPassword: result.temporaryPassword };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo restablecer la contraseña." };
  }
}

export async function changeOwnAdminPassword(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireAdmin();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword !== String(formData.get("confirmPassword") ?? "")) return { error: "Las contraseñas nuevas no coinciden." };
  try {
    await changeAdminPassword(currentPassword, newPassword);
    return { error: "", message: "Tu contraseña se ha actualizado." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo cambiar la contraseña." };
  }
}

export async function setFirstAdminPassword(_state: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const session = await getSession();
  if (session?.role !== "admin" || !session.mustChangePassword) redirect("/admin/carreras");
  const password = String(formData.get("newPassword") ?? "");
  if (password !== String(formData.get("confirmPassword") ?? "")) return { error: "Las contraseñas no coinciden." };
  try {
    await completeAdminPasswordSetup(password);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo establecer la contraseña." };
  }
  revalidatePath("/admin");
  redirect("/admin/carreras");
}
