"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export type LiveAudience = "admin" | "merchant" | "public";

type Props = {
  scopes: string[];
  topics: string[];
  versions: Record<string, number>;
  audience: LiveAudience;
  // Instantes en los que el estado cambia por sí solo (por ejemplo, un bono que empieza o caduca).
  refreshAt?: string[];
  indicator?: boolean;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Cada cuánto se comprueba si hay cambios. Con el aviso instantáneo conectado es solo una red de seguridad.
const POLL_MS = {
  admin: { instant: 20_000, fallback: 3_000 },
  merchant: { instant: 20_000, fallback: 3_000 },
  public: { instant: 60_000, fallback: 20_000 },
} as const;
const MIN_REFRESH_GAP_MS = 800;
const SESSION_RELOAD_GAP_MS = 15_000;
const TIMER_LIMIT_MS = 2_000_000_000;
// No se recarga una página mientras se imprime o se prepara un documento.
const PAUSED_PATHS = ["/admin/carreras/impresion", "/admin/print"];

export function LiveRefresh({ scopes, topics, versions, audience, refreshAt, indicator = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const paused = PAUSED_PATHS.some((path) => pathname.startsWith(path));
  const scopesKey = scopes.join(",");
  const topicsKey = topics.join(",");
  const refreshAtKey = (refreshAt ?? []).join(",");
  const baseline = useRef<Record<string, number>>({ ...versions });
  const inFlight = useRef<AbortController | null>(null);
  const lastRefresh = useRef(0);
  const lastSessionReload = useRef(0);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScopes = useRef(new Set<string>());
  const instantRef = useRef(false);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [instant, setInstant] = useState(false);

  // Tras cada recarga del servidor llegan versiones nuevas: nunca se retrocede.
  useEffect(() => {
    for (const [scope, version] of Object.entries(versions)) baseline.current[scope] = Math.max(baseline.current[scope] ?? 0, version);
  }, [versions]);

  const refreshPage = useCallback((changed: string[]) => {
    for (const scope of changed) pendingScopes.current.add(scope);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    const wait = Math.max(0, MIN_REFRESH_GAP_MS - (Date.now() - lastRefresh.current));
    refreshTimer.current = setTimeout(() => {
      refreshTimer.current = null;
      lastRefresh.current = Date.now();
      const detail = { scopes: [...pendingScopes.current] };
      pendingScopes.current.clear();
      window.dispatchEvent(new CustomEvent("live:changed", { detail }));
      startTransition(() => router.refresh());
    }, wait);
  }, [router]);

  const check = useCallback(async () => {
    if (paused || !scopesKey) return;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(`/api/live?scopes=${encodeURIComponent(scopesKey)}`, { cache: "no-store", signal: controller.signal });
      if (inFlight.current !== controller) return;
      if (response.status === 401 || response.status === 403) {
        // La sesión ya no vale: se recarga y el servidor lleva a la persona al acceso.
        if (Date.now() - lastSessionReload.current > SESSION_RELOAD_GAP_MS) {
          lastSessionReload.current = Date.now();
          refreshPage(["session"]);
        }
        return;
      }
      if (!response.ok) throw new Error(`live ${response.status}`);
      const data = (await response.json()) as { versions?: Record<string, number> };
      if (inFlight.current !== controller) return;
      setStatus("live");
      const current = data.versions ?? {};
      const changed = Object.keys(current).filter((scope) => current[scope] > (baseline.current[scope] ?? 0));
      if (changed.length) {
        for (const scope of changed) baseline.current[scope] = current[scope];
        refreshPage(changed);
      }
    } catch {
      if (inFlight.current === controller) setStatus(navigator.onLine ? "connecting" : "offline");
    } finally {
      clearTimeout(timeout);
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, [paused, refreshPage, scopesKey]);

  // Comprobación periódica, al volver a la pestaña, al recuperar la red y nada más cargar
  // (para detectar lo ocurrido entre que el servidor generó la página y se abrió en el navegador).
  useEffect(() => {
    if (paused || !scopesKey) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      const base = POLL_MS[audience][instantRef.current ? "instant" : "fallback"];
      timer = setTimeout(async () => {
        if (!document.hidden && navigator.onLine) await check();
        if (!stopped) schedule();
      }, base * (0.85 + Math.random() * 0.3));
    };
    const wake = () => {
      if (document.visibilityState !== "visible") return;
      if (refreshAtKey.split(",").some((iso) => iso && Date.parse(iso) + 1_500 < Date.now())) refreshPage(["time"]);
      void check();
    };
    const goOffline = () => setStatus("offline");
    void check();
    schedule();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("offline", goOffline);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("offline", goOffline);
    };
  }, [audience, check, paused, refreshAtKey, refreshPage, scopesKey]);

  // Aviso instantáneo (Supabase Realtime, canales de difusión). Es solo una pista: al recibirla
  // se consulta el sondeo, que es la fuente de verdad. Sin claves públicas, se usa solo el sondeo.
  useEffect(() => {
    if (paused || !SUPABASE_URL || !SUPABASE_ANON_KEY || !topicsKey) return;
    let disposed = false;
    let hint: ReturnType<typeof setTimeout> | undefined;
    let realtime: { disconnect: () => unknown } | null = null;
    const joined = new Set<string>();
    const topicList = topicsKey.split(",");
    void (async () => {
      try {
        const { RealtimeClient } = await import("@supabase/realtime-js");
        if (disposed) return;
        const client = new RealtimeClient(`${SUPABASE_URL.replace(/^http/, "ws")}/realtime/v1`, { params: { apikey: SUPABASE_ANON_KEY } });
        realtime = client;
        for (const topic of topicList) {
          client
            .channel(topic, { config: { broadcast: { self: false } } })
            .on("broadcast", { event: "changed" }, () => {
              if (hint) clearTimeout(hint);
              hint = setTimeout(() => void check(), 150);
            })
            .subscribe((state) => {
              if (disposed) return;
              if (state === "SUBSCRIBED") joined.add(topic); else joined.delete(topic);
              const connected = joined.size === topicList.length;
              instantRef.current = connected;
              setInstant(connected);
            });
        }
      } catch {
        instantRef.current = false;
        setInstant(false);
      }
    })();
    return () => {
      disposed = true;
      instantRef.current = false;
      if (hint) clearTimeout(hint);
      void realtime?.disconnect();
    };
  }, [check, paused, topicsKey]);

  // Cambios que ocurren con el paso del tiempo (un bono que empieza o caduca).
  useEffect(() => {
    if (paused || !refreshAtKey) return;
    const timers = refreshAtKey.split(",").map((iso) => {
      const delay = Date.parse(iso) - Date.now() + 1_500;
      return delay > 0 && delay < TIMER_LIMIT_MS ? setTimeout(() => refreshPage(["time"]), delay) : null;
    });
    return () => timers.forEach((timer) => timer && clearTimeout(timer));
  }, [paused, refreshAtKey, refreshPage]);

  useEffect(() => () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); inFlight.current?.abort(); }, []);

  if (!indicator || paused) return null;
  const seconds = Math.round(POLL_MS[audience].fallback / 1000);
  const label = status === "live" ? "En directo" : status === "offline" ? "Sin conexión" : "Conectando…";
  const detail = instant ? "Los cambios llegan al instante." : `Los cambios se comprueban cada ${seconds} segundos.`;
  return (
    <div className="live-indicator" data-state={status} data-mode={instant ? "instant" : "polling"} title={status === "live" ? detail : label} aria-live="off">
      <span className="live-indicator-dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
