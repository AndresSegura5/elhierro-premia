"use client";

export type PendingRedemption = {
  key: string;
  code: string;
  businessId: string;
  amount: string;
  amountCents: number;
  createdAt: number;
};

const DATABASE = "elhierro-redemption-outbox";
const STORE = "pending";

function openOutbox(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no permite guardar compras pendientes."));
      return;
    }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir la cola local."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openOutbox();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("No se pudo guardar la operación pendiente."));
      transaction.onabort = () => reject(transaction.error ?? new Error("No se pudo guardar la operación pendiente."));
    });
  } finally {
    db.close();
  }
}

export function savePendingRedemption(redemption: PendingRedemption) {
  return withStore("readwrite", (store) => store.put(redemption));
}

export async function getPendingRedemptions(businessId: string): Promise<PendingRedemption[]> {
  const entries = await withStore("readonly", (store) => store.getAll()) as PendingRedemption[];
  return entries.filter((entry) => entry.businessId === businessId).sort((left, right) => left.createdAt - right.createdAt);
}

export function removePendingRedemption(key: string) {
  return withStore("readwrite", (store) => store.delete(key));
}
