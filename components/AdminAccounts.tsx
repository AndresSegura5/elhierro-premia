"use client";

import { useActionState, useEffect, useId, useState, type ReactNode } from "react";
import { KeyRound, ShieldCheck, UserPlus, X } from "lucide-react";
import type { AdminAccountSummary } from "@/lib/auth";
import { addAdminAccount, changeOwnAdminPassword, resetAdminPasswordAction, type AdminActionState } from "@/app/admin/admin-account-actions";

const emptyState: AdminActionState = { error: "" };

function CredentialNotice({ state }: { state: AdminActionState }) {
  if (state.error) return <p className="admin-notice admin-notice--error" role="alert">{state.error}</p>;
  if (!state.message) return null;
  return <div className="admin-credential" role="status"><p>{state.message}</p>{state.temporaryPassword && <p>Clave temporal: <code>{state.temporaryPassword}</code></p>}<small>Esta clave solo se muestra ahora. Cópiala y entrégala de forma segura.</small></div>;
}

function ResetAdminButton({ account }: { account: AdminAccountSummary }) {
  const [state, action, pending] = useActionState(resetAdminPasswordAction, emptyState);
  const [open, setOpen] = useState(false);
  return <>
    <button className="button subtle" type="button" onClick={() => setOpen(true)}><KeyRound size={16} aria-hidden="true" />Restablecer contraseña</button>
    {open && <AdminAccountModal title={`Restablecer contraseña · ${account.first_name ?? account.username}`} onClose={() => setOpen(false)}>
      <div className="admin-account-dialog-content">
        <p>Se generará una clave temporal y se cerrarán las sesiones de esta cuenta. Al volver a entrar, el administrador tendrá que establecer una contraseña nueva.</p>
        <form action={action}>
          <input type="hidden" name="userId" value={account.id} />
          <button className="button business-delete-confirm-button" type="submit" disabled={pending}><KeyRound size={16} aria-hidden="true" />{pending ? "Generando…" : "Generar clave temporal"}</button>
        </form>
        <CredentialNotice state={state} />
      </div>
    </AdminAccountModal>}
  </>;
}

function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changeOwnAdminPassword, emptyState);
  return <div className="admin-account-dialog-content">
    <p>Usa al menos 12 caracteres. Al guardarla, se cerrarán tus otras sesiones.</p>
    <form action={action} className="admin-account-form admin-account-password-form">
      <label>Contraseña actual<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
      <label>Nueva contraseña<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></label>
      <label>Repite la nueva contraseña<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></label>
      <button className="button" type="submit" disabled={pending}>{pending ? "Guardando…" : "Cambiar contraseña"}</button>
      <CredentialNotice state={state} />
    </form>
  </div>;
}

function AddAdminForm({ canWrite }: { canWrite: boolean }) {
  const [state, action, pending] = useActionState(addAdminAccount, emptyState);
  return <div className="admin-account-dialog-content">
    <p>La nueva persona entrará con su correo y una clave temporal. Al primer acceso establecerá su propia contraseña.</p>
    {!canWrite && <p className="admin-notice admin-notice--error">La gestión está desactivada hasta conectar una base de datos persistente.</p>}
    <form action={action} className="admin-account-form">
      <label>Nombre<input name="firstName" autoComplete="given-name" minLength={2} maxLength={80} required disabled={!canWrite} /></label>
      <label>Apellidos<input name="lastName" autoComplete="family-name" minLength={2} maxLength={100} required disabled={!canWrite} /></label>
      <label className="admin-account-wide">Correo electrónico<input name="email" type="email" autoComplete="email" maxLength={254} required disabled={!canWrite} /></label>
      <button className="button" type="submit" disabled={!canWrite || pending}><UserPlus size={17} aria-hidden="true" />{pending ? "Creando…" : "Crear administrador"}</button>
      <CredentialNotice state={state} />
    </form>
  </div>;
}

function AdminAccountModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.body.classList.add("has-business-modal");
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.classList.remove("has-business-modal");
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
  return <div className="business-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="business-modal admin-account-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="business-modal-heading">
        <div className="panel-title"><KeyRound size={20} aria-hidden="true" /><h2 id={titleId}>{title}</h2></div>
        <button className="business-modal-close" type="button" onClick={onClose} aria-label="Cerrar"><X size={20} aria-hidden="true" /></button>
      </header>
      {children}
    </section>
  </div>;
}

export function AdminAccounts({ accounts, actingAdminId, canWrite }: { accounts: AdminAccountSummary[]; actingAdminId: number; canWrite: boolean }) {
  const [activeModal, setActiveModal] = useState<"add" | "password" | null>(null);
  return <div className="admin-accounts">
    <div className="admin-account-actions">
      <button className="button subtle" type="button" onClick={() => setActiveModal("password")}><KeyRound size={17} aria-hidden="true" />Cambiar mi contraseña</button>
      <button className="button" type="button" onClick={() => setActiveModal("add")} disabled={!canWrite}><UserPlus size={17} aria-hidden="true" />Añadir administrador</button>
    </div>
    {activeModal === "add" && <AdminAccountModal title="Añadir administrador" onClose={() => setActiveModal(null)}><AddAdminForm canWrite={canWrite} /></AdminAccountModal>}
    {activeModal === "password" && <AdminAccountModal title="Cambiar mi contraseña" onClose={() => setActiveModal(null)}><PasswordChangeForm /></AdminAccountModal>}

    <section className="admin-account-panel admin-account-list-panel">
      <h2><ShieldCheck size={20} aria-hidden="true" />Administradores</h2>
      <div className="admin-account-list">
        {accounts.map((account) => {
          const name = [account.first_name, account.last_name].filter(Boolean).join(" ") || account.username;
          const isSelf = account.id === actingAdminId;
          return <article className="admin-account-row" key={account.id}>
            <span><strong>{name}{isSelf ? " (tú)" : ""}</strong><small>{account.is_superuser ? "Superusuario" : account.email ?? `Usuario: ${account.username}`}{account.must_change_password ? " · Debe establecer contraseña" : ""}</small></span>
            {isSelf ? <small className="admin-account-self">Tu contraseña se cambia con el botón «Cambiar mi contraseña».</small> : canWrite ? <ResetAdminButton account={account} /> : <button className="button subtle" disabled>Restablecer contraseña</button>}
          </article>;
        })}
      </div>
    </section>
  </div>;
}

export function FirstAdminPasswordForm({ action }: { action: (state: AdminActionState, formData: FormData) => Promise<AdminActionState> }) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  return <form action={formAction} className="auth-form">
    <label htmlFor="admin-new-password">Nueva contraseña</label>
    <div className="auth-input-wrap"><KeyRound size={19} aria-hidden="true" /><input id="admin-new-password" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></div>
    <label htmlFor="admin-confirm-password">Repite la nueva contraseña</label>
    <div className="auth-input-wrap"><KeyRound size={19} aria-hidden="true" /><input id="admin-confirm-password" name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} required /></div>
    {state.error && <p className="admin-notice admin-notice--error" role="alert">{state.error}</p>}
    <button className="button auth-submit" type="submit" disabled={pending}>{pending ? "Guardando…" : "Establecer contraseña"}</button>
  </form>;
}
