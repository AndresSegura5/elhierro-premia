export type SignInResult =
  | { success: true }
  | { success: false; reason: "invalid" | "locked" | "unavailable" };

export function signInError(result: SignInResult) {
  if (result.success) return "";
  if (result.reason === "unavailable") return "El acceso de este comercio no está activo. Contacta con la organización.";
  // Do not expose whether an account exists by distinguishing wrong credentials
  // from an account lock. Request limits provide the visible waiting message.
  return "No se pudo iniciar sesión. Comprueba el usuario y la contraseña o inténtalo más tarde.";
}
