"use client";

import { useActionState } from "react";
import { createMerchantAccess } from "@/app/auth-actions";
import type { Business } from "@/lib/types";

export function MerchantAccounts({ businesses, accounts }: {
  businesses: Business[];
  accounts: Array<{ username: string; business_id: string }>;
}) {
  const [state, action, pending] = useActionState(createMerchantAccess, { error: "", username: "", password: "", businessId: "" });
  const byBusiness = new Map(accounts.map((account) => [account.business_id, account.username]));
  return <section className="admin-accounts" aria-labelledby="merchant-accounts-title">
    <div className="panel-title"><h2 id="merchant-accounts-title">Accesos de comercios</h2></div>
    <p>Genera una contraseña para cada negocio y entrégala de forma privada. Al regenerarla, se cierran sus sesiones anteriores.</p>
    <div className="admin-account-list">
      {businesses.map((business) => <div className="admin-account-row" key={business.id}>
        <span><strong>{business.name}</strong><small>{byBusiness.get(business.id) ?? "Sin acceso"}</small></span>
        <form action={action}><input name="businessId" type="hidden" value={business.id} /><button className="button subtle" disabled={pending} type="submit">{byBusiness.has(business.id) ? "Restablecer clave" : "Crear acceso"}</button></form>
      </div>)}
    </div>
    {state.error && <p className="admin-notice admin-notice--error" role="alert">{state.error}</p>}
    {state.password && <div className="admin-credential" role="status"><strong>Credenciales de {businesses.find((business) => business.id === state.businessId)?.name}</strong><p>Usuario: <code>{state.username}</code></p><p>Contraseña: <code>{state.password}</code></p><small>Esta contraseña solo se muestra ahora. Entrégala por un canal privado.</small></div>}
  </section>;
}
