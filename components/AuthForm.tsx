"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import type { AuthState } from "@/app/auth-actions";

export function AuthForm({ action, setup = false, identifierLabel = "Usuario" }: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  setup?: boolean;
  identifierLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });
  const [showPassword, setShowPassword] = useState(false);
  return <form action={formAction} className="auth-form">
    <label htmlFor="auth-username">{identifierLabel}</label>
    <div className="auth-input-wrap">
      <UserRound size={19} aria-hidden="true" />
      <input id="auth-username" name="username" type="text" autoComplete="username" minLength={identifierLabel === "Usuario" ? 4 : undefined} maxLength={identifierLabel === "Usuario" ? 40 : 254} autoCapitalize="none" autoCorrect="off" spellCheck={false} required />
    </div>
    <label htmlFor="auth-password">Contraseña</label>
    <div className="auth-input-wrap">
      <LockKeyhole size={19} aria-hidden="true" />
      <input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete={setup ? "new-password" : "current-password"} minLength={setup ? 12 : undefined} required />
      <button className="auth-password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword}>
        {showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}
      </button>
    </div>
    {state.error && <p className="admin-notice admin-notice--error" role="alert">{state.error}</p>}
    <button className="button auth-submit" type="submit" disabled={pending}>{pending ? "Comprobando..." : setup ? "Crear cuenta" : "Iniciar sesión"}<ArrowRight size={18} aria-hidden="true" /></button>
  </form>;
}
