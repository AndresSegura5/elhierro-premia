"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { adminExists, createFirstAdmin, getSession, provisionMerchant, requireAdmin, signInDetailed, signOut } from "@/lib/auth";
import { signInError } from "@/lib/auth-result";
import { headers } from "next/headers";
import { consumeLoginAttempt } from "@/lib/request-limit";
import { demoWritesEnabled } from "@/lib/store";

export type AuthState = { error: string };

export async function setupAdmin(_state: AuthState, formData: FormData): Promise<AuthState> {
  if (process.env.NODE_ENV !== "development") return { error: "La configuración inicial no está disponible en este entorno." };
  try {
    await createFirstAdmin(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la cuenta." };
  }
  redirect("/admin/login?creada=1");
}

export async function loginAdmin(_state: AuthState, formData: FormData): Promise<AuthState> {
  const limit = await consumeLoginAttempt(await headers(), String(formData.get("username") ?? ""), "admin");
  if (!limit.allowed) return { error: "Demasiados intentos de acceso. Espera 15 minutos y vuelve a intentarlo." };
  if (!(await adminExists())) return { error: "La cuenta de administración aún no está configurada." };
  const result = await signInDetailed(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""), "admin");
  if (!result.success) return { error: signInError(result) };
  if ((await getSession())?.mustChangePassword) redirect("/admin/primer-acceso");
  redirect("/admin/carreras");
}

export async function loginMerchant(_state: AuthState, formData: FormData): Promise<AuthState> {
  const limit = await consumeLoginAttempt(await headers(), String(formData.get("username") ?? ""), "merchant");
  if (!limit.allowed) return { error: "Demasiados intentos de acceso. Espera 15 minutos y vuelve a intentarlo." };
  const result = await signInDetailed(String(formData.get("username") ?? ""), String(formData.get("password") ?? ""), "merchant");
  if (!result.success) return { error: signInError(result) };
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
