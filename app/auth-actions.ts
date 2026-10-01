"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminExists, createFirstAdmin, getSession, provisionMerchant, requireAdmin, signIn, signOut } from "@/lib/auth";
import { demoWritesEnabled } from "@/lib/store";

export type AuthState = { error: string };

export async function setupAdmin(_state: AuthState, formData: FormData): Promise<AuthState> {
  try {
    await createFirstAdmin(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la cuenta." };
  }
  redirect("/admin/login?creada=1");
}

export async function loginAdmin(_state: AuthState, formData: FormData): Promise<AuthState> {
  if (!(await adminExists())) return { error: "La cuenta de administración aún no está configurada." };
  const success = await signIn(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""), "admin");
  if (!success) return { error: "Usuario o contraseña incorrectos. Tras varios intentos, espera 15 minutos." };
  if ((await getSession())?.mustChangePassword) redirect("/admin/primer-acceso");
  redirect("/admin/carreras");
}

export async function loginMerchant(_state: AuthState, formData: FormData): Promise<AuthState> {
  const success = await signIn(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""), "merchant");
  if (!success) return { error: "Usuario o contraseña incorrectos. Tras varios intentos, espera 15 minutos." };
  redirect("/comercio");
}

export async function logout() {
  const role = (await getSession())?.role;
  await signOut();
  redirect(role === "admin" ? "/admin/login" : "/comercio/login");
}

export type MerchantCredentialState = { error: string; username: string; password: string; businessId: string };

export async function createMerchantAccess(_state: MerchantCredentialState, formData: FormData): Promise<MerchantCredentialState> {
  await requireAdmin();
  if (!demoWritesEnabled()) return { error: "La gestión de accesos necesita una base de datos persistente.", username: "", password: "", businessId: "" };
  const businessId = String(formData.get("businessId") ?? "");
  try {
    const credentials = await provisionMerchant(businessId);
    revalidatePath("/admin");
    revalidatePath("/admin/comercios");
    return { error: "", businessId, ...credentials };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el acceso.", username: "", password: "", businessId: "" };
  }
}
