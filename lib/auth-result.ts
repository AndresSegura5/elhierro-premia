export type SignInResult =
  | { success: true }
  | { success: false; reason: "invalid" | "locked" | "unavailable" };

export function signInError(result: SignInResult) {
  if (result.success) return "";
  if (result.reason === "locked") return "El acceso está bloqueado temporalmente por varios intentos fallidos. Espera 15 minutos desde el último bloqueo y vuelve a intentarlo.";
  if (result.reason === "unavailable") return "El acceso de este comercio no está activo. Contacta con la organización.";
  return "Usuario o contraseña incorrectos.";
}
